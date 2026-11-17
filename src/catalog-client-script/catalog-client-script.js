'use strict';

const api = require('../../utils/api-client');
const { resolveConditions, renameVars } = require('../../utils/resolve-names');

const TABLE = 'catalog_script_client';

// Alpar Standard — Catalog Client Scripts:
//  - ui_type: ALWAYS "10" (All) — applies to all catalog views
//  - type: "onLoad" | "onChange" | "onSubmit" | "onCatalogLoad"
//
// Auto-fill tip: for simple default values (e.g. current user), prefer
// setting default_value = "javascript:gs.getUserID()" directly on the
// variable instead of creating an onLoad script.
//
// See: docs/standards/alpar-standards.md §10

module.exports = {
  TYPES: {
    ON_LOAD:         'onLoad',
    ON_CHANGE:       'onChange',
    ON_SUBMIT:       'onSubmit',
    ON_CATALOG_LOAD: 'onCatalogLoad',
  },

  async create({
    name,
    catItemId,
    variableSetId,
    script,
    type = 'onLoad',
    active = true,
    appliesTo = 'item',
    scope,
  } = {}) {
    const data = {
      name,
      script,
      type,
      active,
      applies_to: appliesTo,
      ui_type:    '10',     // Always "10" (All) — Alpar standard
    };
    if (catItemId)     data.cat_item     = catItemId;
    if (variableSetId) data.variable_set = variableSetId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  // Client Script do export (item ou set). cat_variable/condition chegam com IO:{nome} → IO:<sys_id>; o código
  // cita as variáveis pelo nome AS IS → renomeado para o nome da instância (v_/vs_). Idempotente por owner+name+cat_variable.
  async createFromExport(c, { catItemId, variableSetId, vars, renames }) {
    const catVar = resolveConditions(c.cat_variable, vars);
    const cond   = resolveConditions(c.condition, vars);
    const missing = [...catVar.missing, ...cond.missing];
    if (missing.length) return { skipped: `variável não encontrada: ${missing.join(', ')}` };

    const data = {
      ...c.extra,   // description, order, messages, global, applies_extended, field, isolate_script, va_supported (como no export)
      name:                  c.name,
      script:                renameVars(c.source, renames),
      type:                  c.type,
      active:                c.active,
      applies_to:            catItemId ? 'item' : 'set',
      ui_type:               c.ui_type || '10',
      applies_catalog:       c.applies_catalog,
      applies_req_item:      c.applies_req_item,
      applies_sc_task:       c.applies_sc_task,
      applies_target_record: c.applies_target_record,
      ...(catVar.text && { cat_variable: catVar.text }),
      ...(cond.text   && { condition: cond.text }),
      ...(catItemId ? { cat_item: catItemId } : { variable_set: variableSetId }),
    };
    const owner = catItemId ? `cat_item=${catItemId}` : `variable_set=${variableSetId}`;
    const res   = await api.createUnique(TABLE, `${owner}^name=${c.name}^cat_variable=${catVar.text}`, data);
    return { sys_id: res.result.sys_id, existed: !!res.result._existed, renamed: renameVars(c.source, renames) !== c.source };
  },

  async get(query = '', fields = 'sys_id,name,cat_item,type,active,ui_type') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) { return api.getOne(TABLE, sysId); },

  async getByCatItem(catItemId) {
    return api.get(TABLE, {
      sysparm_query: `cat_item=${catItemId}`,
      sysparm_fields: 'sys_id,name,type,active,ui_type',
    });
  },

  async update(sysId, fields) { return api.update(TABLE, sysId, fields); },
};
