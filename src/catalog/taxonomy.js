'use strict';

const api = require('../../utils/api-client');

// Taxonomy — table can vary by instance/plugin:
//   CSM: sn_cmt_taxonomy
//   ITSM hierarchy: sc_category (nested)
// Adjust TABLE constant based on your instance configuration.
const TABLE = 'sn_cmt_taxonomy';

// Key fields: name, description, parent (self-ref for hierarchy), active

module.exports = {
  async create({ name, description = '', parentId = null, active = true, scope } = {}) {
    const data = { name, description, active };
    if (parentId) data.parent = parentId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,parent,active') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },

  async list(limit = 100) {
    return api.get(TABLE, { sysparm_limit: limit, sysparm_fields: 'sys_id,name,active' });
  },
};
