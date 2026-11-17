'use strict';

const api = require('../../utils/api-client');

const TABLE = 'item_option_new_set';

// Alpar Standard — Variable Sets:
//  - Variable Set name: descriptive, no mandatory prefix (ex: "Hardware Information")
//  - Variables INSIDE this set MUST use prefix "vs_" (not "v_")
//  - type (item_option_new_set.type): ONLY 'one_to_one' or 'one_to_many' — never '1' (default: one_to_one)
//  - mandatory / read_only / visible: NEVER set on variables — always via UI Policy
//
// See: docs/standards/alpar-standards.md §7

const SET_TYPES = ['one_to_one', 'one_to_many'];

module.exports = {
  SET_TYPES,

  async create({ name, title, description = '', type = 'one_to_one', active = true, displayTitle, layout, order, scope } = {}) {
    if (!SET_TYPES.includes(type)) throw new Error(`Variable Set type inválido: "${type}". Use one_to_one ou one_to_many.`);
    const data = { name, title, description, type, active };
    if (displayTitle !== undefined) data.display_title = displayTitle;
    if (layout)                     data.layout        = layout;
    if (order)                      data.order         = order;
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
  async attachToCatalogItem(variableSetId, catItemId, order = 100, layout) {
    return api.createUnique('io_set_item', `sc_cat_item=${catItemId}^variable_set=${variableSetId}`, {
      sc_cat_item:   catItemId,
      variable_set:  variableSetId,   // ← correct field name (not item_option_new_set)
      order,
      ...(layout && { layout }),
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
  async addVariable({ variableSetId, name, questionText, type = '1', active = true, order = 100, defaultValue = '', helpText = '', referenceTable, mandatory, readOnly, hidden, scope, referenceQualifier, extra = {} } = {}) {
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
      // mandatory / read_only / hidden: only when passed (rules mode "variable"); default is UI Policy
    };
    if (referenceTable) data.reference = referenceTable;   // table NAME, not sys_id
    if (referenceQualifier) data.reference_qual = referenceQualifier;
    if (mandatory) data.mandatory = true;
    if (readOnly)  data.read_only = true;
    if (hidden)    data.hidden    = true;
    Object.assign(data, extra);
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.createUnique('item_option_new', `variable_set=${variableSetId}^name=${prefixedName}`, data);
  },
};
