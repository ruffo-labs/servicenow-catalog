'use strict';

require('dotenv').config();

const BASE_URL = `${process.env.SERVICENOW_INSTANCE}/api/1851835/ai_adapter_rest`;

function getAuthHeader() {
  const credentials = Buffer.from(
    `${process.env.SERVICENOW_USER}:${process.env.SERVICENOW_PASSWORD}`
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

  return data.result;
}

module.exports = {
  async get(table, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/${table}${qs ? '?' + qs : ''}`);
  },

  async getOne(table, sysId) {
    return request('GET', `/${table}?sys_id=${sysId}`);
  },

  async create(table, data) {
    return request('POST', `/${table}`, { data });
  },

  async update(table, sysId, data) {
    return request('PUT', `/${table}/${sysId}`, { data });
  },

  async updateByQuery(table, query, data) {
    const encoded = encodeURIComponent(query);
    return request('PUT', `/${table}/_?sysparm_query=${encoded}`, { data });
  },
};
