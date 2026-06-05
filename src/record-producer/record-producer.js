'use strict';

const api = require('../../utils/api-client');

const TABLE = 'sc_cat_item_producer';

// Alpar Standard — Catalog Item vs Record Producer:
//  - Table "sc_req_item" → must be created as Catalog Item (sc_cat_item), NOT Record Producer
//  - Any other table   → create as Record Producer (this module)
//
// See: docs/standards/alpar-standards.md §3

module.exports = {
  async create({
    name,
    shortDescription = '',
    description = '',
    tableName,
    script = '',
    categoryId,
    active = true,
    scope,
  } = {}) {
    if (tableName === 'sc_req_item') {
      throw new Error(
        '[Alpar Standard] Table "sc_req_item" must be created as a Catalog Item, not a Record Producer. ' +
        'Use the catalog-item module instead. See docs/standards/alpar-standards.md §3'
      );
    }

    const data = {
      name,
      short_description: shortDescription,
      description,
      table_name: tableName,
      script,
      active,
    };
    if (categoryId) data.category = categoryId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,table_name,active,category') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },

  async list(limit = 100) {
    return api.get(TABLE, { sysparm_limit: limit, sysparm_fields: 'sys_id,name,table_name,active' });
  },
};
