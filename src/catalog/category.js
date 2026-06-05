'use strict';

const api = require('../../utils/api-client');

const TABLE = 'sc_category';

// Alpar Standard — Category:
//  - Always check if the category already exists before creating
//  - Use findOrCreate to follow the standard automatically
//
// See: docs/standards/alpar-standards.md §5

module.exports = {
  async create({ title, catalogId, description = '', active = true, order = 100, scope } = {}) {
    const data = { title, description, active, order };
    if (catalogId) data.parent = catalogId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  // Standard method — checks existence before creating
  // Returns { sys_id, title, _existed: true/false }
  async findOrCreate({ title, catalogId, description = '', active = true, order = 100, scope } = {}) {
    const res = await api.get(TABLE, {
      sysparm_query: `title=${title}`,
      sysparm_fields: 'sys_id,title,active',
      sysparm_limit: 1,
    });

    const records = res?.result ?? res;
    if (Array.isArray(records) && records.length > 0) {
      return { ...records[0], _existed: true };
    }

    const created = await this.create({ title, catalogId, description, active, order, scope });
    return { ...created, _existed: false };
  },

  async get(query = '', fields = 'sys_id,title,parent,active,order') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async getByCatalog(catalogId) {
    return api.get(TABLE, {
      sysparm_query: `parent=${catalogId}`,
      sysparm_fields: 'sys_id,title,active,order',
    });
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },
};
