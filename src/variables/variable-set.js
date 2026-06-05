'use strict';

const api = require('../../utils/api-client');

const TABLE = 'item_option_new_set';

// Alpar Standard — Variable Sets:
//  - Variable Set name: descriptive, no mandatory prefix (ex: "Hardware Information")
//  - Variables INSIDE this set MUST use prefix "vs_" (not "v_")
//  - mandatory / read_only / visible: NEVER set on variables — always via UI Policy
//
// See: docs/standards/alpar-standards.md §7

module.exports = {
  async create({ name, title, description = '', type = '1', active = true, scope } = {}) {
    const data = { name, title, description, type, active };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,title,type,active') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },

  async list(limit = 100) {
    return api.get(TABLE, { sysparm_limit: limit, sysparm_fields: 'sys_id,name,title,active' });
  },

  // Link an existing Variable Set to a Catalog Item (creates io_set_item record)
  // io_set_item fields confirmed via XML export: sc_cat_item + variable_set + order
  async attachToCatalogItem(variableSetId, catItemId, order = 100) {
    return api.create('io_set_item', {
      sc_cat_item:   catItemId,
      variable_set:  variableSetId,   // ← correct field name (not item_option_new_set)
      order,
    });
  },

  // Query existing links for a catalog item
  async getLinkedSets(catItemId) {
    return api.get('io_set_item', {
      sysparm_query:  `sc_cat_item=${catItemId}`,
      sysparm_fields: 'sys_id,variable_set,order',
      sysparm_orderby: 'order',
    });
  },

  // Add a variable inside this Variable Set — name auto-prefixed with "vs_"
  async addVariable({ variableSetId, name, questionText, type = '1', active = true, order = 100, defaultValue = '', helpText = '', scope } = {}) {
    const prefixedName = name.startsWith('vs_') ? name : `vs_${name}`;
    const data = {
      name: prefixedName,
      question_text: questionText,
      type,
      variable_set: variableSetId,
      active,
      order,
      default_value: defaultValue,
      help_text: helpText,
      // mandatory / read_only / visible omitted — set via UI Policy
    };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create('item_option_new', data);
  },
};
