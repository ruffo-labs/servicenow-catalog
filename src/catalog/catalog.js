'use strict';

const api = require('../../utils/api-client');

const TABLE = 'sc_catalog';

// Key fields: title, description, active, manager (sys_user ref), homepage (sp_page ref)

module.exports = {
  async create({ title, description = '', active = true, scope } = {}) {
    const data = { title, description, active };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,title,description,active') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },

  async list(limit = 100) {
    return api.get(TABLE, { sysparm_limit: limit, sysparm_fields: 'sys_id,title,active' });
  },
};
