'use strict';

require('dotenv').config();

const BASE_URL = `${process.env.SN_INSTANCE_URL}/api/1851835/ai_adapter_rest`;

function getAuthHeader() {
  const credentials = Buffer.from(
    `${process.env.SN_USERNAME}:${process.env.SN_PASSWORD}`
  ).toString('base64');
  return `Basic ${credentials}`;
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.detail || data.error?.message || `HTTP ${res.status}`;
    throw new Error(`[${method} ${path}] ${msg}`);
  }

  // colunas que o AI Bridge ignorou (não existem na tabela): acumula por tabela para o resumo final
  const skipped = data.result?.meta?.fields_skipped || data.meta?.fields_skipped;
  if (skipped?.length) {
    const table = path.split('?')[0].split('/')[1];
    for (const f of skipped) (api.skipped[table] ??= new Set()).add(f);
  }

  return data.result;
}

// Tabelas de catálogo que recebem sys_scope/sys_package quando api.scope está definido
const SCOPED = new Set(['contract_sla', 'sc_cat_item_user_criteria_mtom', 'sc_cat_item_user_criteria_no_mtom', 'sc_cat_item', 'sc_cat_item_producer', 'item_option_new', 'question_choice', 'catalog_ui_policy',
  'catalog_ui_policy_action', 'catalog_script_client', 'io_set_item', 'sc_category']);

const api = module.exports = {
  skipped: {},   // { tabela: Set(colunas ignoradas) }
  scope: null,   // sys_id do escopo (sys_app) onde os registros de catálogo são gravados

  async get(table, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/${table}${qs ? '?' + qs : ''}`);
  },

  async getOne(table, sysId) {
    return request('GET', `/${table}?sys_id=${sysId}`);
  },

  async create(table, data) {
    if (this.scope && SCOPED.has(table)) data = { ...data, sys_scope: this.scope, sys_package: this.scope };
    return request('POST', `/${table}`, { data });
  },

  // sys_id of the first record matching an encoded query, or null
  async findId(table, query) {
    const res  = await this.get(table, { sysparm_query: query, sysparm_fields: 'sys_id', sysparm_limit: 1 });
    const rows = Array.isArray(res) ? res : res?.result;
    return rows?.[0]?.sys_id ?? null;
  },

  // Idempotent create: reuses the record matching `query`. Same shape as a POST response ({ result: { sys_id } }),
  // plus `_existed: true` when it was already there.
  async createUnique(table, query, data) {
    const id = await this.findId(table, query);
    if (id && this.updateExisting) await this.update(table, id, data);   // modo --update: grava os campos do export no registro existente
    return id ? { result: { sys_id: id, _existed: true } } : this.create(table, data);
  },

  // O AI Bridge ignora `sys_id` no POST. A Table API padrão respeita — usada só onde o sys_id precisa ser preservado
  // (ex.: service offerings, referenciados por condições). Idempotente por sys_id.
  async createWithSysId(table, data) {
    if (await this.findId(table, `sys_id=${data.sys_id}`)) return { result: { sys_id: data.sys_id, _existed: true } };
    const res  = await fetch(`${process.env.SN_INSTANCE_URL}/api/now/table/${table}`, {
      method: 'POST',
      headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(`[POST /api/now/table/${table}] ${json.error?.message || `HTTP ${res.status}`}`);
    return { result: { sys_id: json.result.sys_id } };
  },

  async update(table, sysId, data) {
    return request('PUT', `/${table}/${sysId}`, { data });
  },

  async updateByQuery(table, query, data) {
    const encoded = encodeURIComponent(query);
    return request('PUT', `/${table}/_?sysparm_query=${encoded}`, { data });
  },
};

// DELETE via Table API padrão (o AI Bridge não suporta DELETE); usado para trocar vínculos m2m e limpar testes próprios
module.exports.delete = async (table, sysId) => {
  const res = await fetch(`${process.env.SN_INSTANCE_URL}/api/now/table/${table}/${sysId}`, { method: 'DELETE', headers: { Authorization: getAuthHeader(), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`[DELETE /api/now/table/${table}] HTTP ${res.status}`);
  return true;
};
