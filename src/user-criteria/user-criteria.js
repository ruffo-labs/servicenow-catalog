'use strict';

const api = require('../../utils/api-client');

const TABLE = 'user_criteria';

// Key fields: name, active, roles (sys_user_role refs), groups (sys_user_group refs),
// users (sys_user refs), companies, departments, locations,
// match_all (true=AND logic, false=OR logic)

module.exports = {
  async create({
    name,
    active = true,
    roles = '',
    groups = '',
    users = '',
    companies = '',
    departments = '',
    locations = '',
    matchAll = false,
    scope,
  } = {}) {
    const data = { name, active, roles, groups, users, companies, departments, locations, match_all: matchAll };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,active,roles,groups') {
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

  async attachToCatalogItem(userCriteriaId, catItemId, type = 'can_view') {
    // type: 'can_view' | 'cannot_view'
    const mtomTable = type === 'cannot_view'
      ? 'sc_cat_item_user_criteria_no_mtom'
      : 'sc_cat_item_user_criteria_mtom';
    return api.create(mtomTable, {
      sc_cat_item: catItemId,
      user_criteria: userCriteriaId,
    });
  },
};
