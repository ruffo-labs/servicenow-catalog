'use strict';

const api = require('../../utils/api-client');

const TABLE = 'catalog_script_client';

// Alpar Standard — Catalog Client Scripts:
//  - ui_type: ALWAYS "10" (All) — applies to all catalog views
//  - type: "onLoad" | "onChange" | "onSubmit" | "onCatalogLoad"
//
// Auto-fill tip: for simple default values (e.g. current user), prefer
// setting default_value = "javascript:gs.getUserID()" directly on the
// variable instead of creating an onLoad script.
//
// See: docs/standards/alpar-standards.md §10

module.exports = {
  TYPES: {
    ON_LOAD:         'onLoad',
    ON_CHANGE:       'onChange',
    ON_SUBMIT:       'onSubmit',
    ON_CATALOG_LOAD: 'onCatalogLoad',
  },

  async create({
    name,
    catItemId,
    variableSetId,
    script,
    type = 'onLoad',
    active = true,
    appliesTo = 'item',
    scope,
  } = {}) {
    const data = {
      name,
      script,
      type,
      active,
      applies_to: appliesTo,
      ui_type:    '10',     // Always "10" (All) — Alpar standard
    };
    if (catItemId)     data.cat_item     = catItemId;
    if (variableSetId) data.variable_set = variableSetId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,cat_item,type,active,ui_type') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) { return api.getOne(TABLE, sysId); },

  async getByCatItem(catItemId) {
    return api.get(TABLE, {
      sysparm_query: `cat_item=${catItemId}`,
      sysparm_fields: 'sys_id,name,type,active,ui_type',
    });
  },

  async update(sysId, fields) { return api.update(TABLE, sysId, fields); },
};
