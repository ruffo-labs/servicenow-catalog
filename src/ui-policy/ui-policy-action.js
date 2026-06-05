'use strict';

const api = require('../../utils/api-client');

const TABLE = 'catalog_ui_policy_action';

// Alpar Standard — UI Policy Actions (confirmed via XML export):
//
//  catalog_item     : "{cat_item_sys_id}"           ← REQUIRED
//  catalog_variable : "IO:{variable_sys_id}"        ← REQUIRED — IO: prefix
//  variable         : "{variable_name}"             ← plain name, e.g. "v_requested_for"
//  mandatory        : "true" / "false" / "ignore"
//  visible          : "true" / "false" / "ignore"
//  disabled         : "true" / "false" / "ignore"   (disabled = read only)
//  value_action     : "ignore"                      ← always "ignore"
//  cleared          : "false"
//  field_message_type: "none"
//  order            : same order as the parent UI Policy (100 / 200 / 300 / 1000)
//
//  ⚠️ Use "ignore" (NOT "leave") for fields that should not be changed
//
// See: docs/standards/alpar-standards.md §9

module.exports = {
  async create({
    uiPolicyId,
    catItemId,
    variableSysId,
    variableName,       // plain name e.g. "v_requested_for"
    mandatory = 'ignore',
    visible = 'ignore',
    disabled = 'ignore',
    order = 100,
  } = {}) {
    return api.create(TABLE, {
      ui_policy:          uiPolicyId,
      catalog_item:       catItemId,
      catalog_variable:   `IO:${variableSysId}`,   // IO: prefix required
      variable:           variableName,             // plain variable name
      mandatory,
      visible,
      disabled,
      value_action:       'ignore',
      cleared:            'false',
      field_message_type: 'none',
      order,
    });
  },

  async get(query = '', fields = 'sys_id,ui_policy,catalog_variable,variable,mandatory,visible,disabled') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getByPolicy(uiPolicyId) {
    return api.get(TABLE, {
      sysparm_query: `ui_policy=${uiPolicyId}`,
      sysparm_fields: 'sys_id,catalog_variable,variable,mandatory,visible,disabled',
    });
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },
};
