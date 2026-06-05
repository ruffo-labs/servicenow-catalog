'use strict';

const api = require('../../utils/api-client');

// Multirow Variable Set — allows repeating groups of variables in a catalog item
const TABLE = 'sc_multi_row_question_set';

// Key fields: name, label, description, active, sys_scope
// Individual variables are stored in sc_multi_row_question (linked via multi_row_question_set)

module.exports = {
  async create({ name, label, description = '', active = true, scope } = {}) {
    const data = { name, label, description, active };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,label,active') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },

  async addVariable({
    multirowSetId,
    name,
    questionText,
    type = '1',
    mandatory = false,
    order = 100,
    scope,
  } = {}) {
    const data = {
      name,
      question_text: questionText,
      type,
      mandatory,
      order,
      multi_row_question_set: multirowSetId,
    };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create('sc_multi_row_question', data);
  },
};
