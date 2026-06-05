'use strict';

const api = require('../../utils/api-client');

const TABLE = 'catalog_ui_policy';

// Alpar Standard — UI Policies:
//
//  NAMING: short_description = "[PREFIX] - [variable_name]"  (both in square brackets)
//  One UI Policy record PER VARIABLE PER rule type (MDT, VSB, RO)
//  [ROS] = single policy per item covering all variables
//
//  CONDITION FIELD: "catalog_conditions" (NOT "conditions")
//  CONDITION FORMAT: "IO:{variable_sys_id}ISNOTEMPTY^EQ"
//
//  WHEN a variable has a "when" block in JSON:
//    → apply catalog_conditions to ALL layers whose value is NOT "ignore"
//    → always set reverse_if_false = true
//
// See: docs/standards/alpar-standards.md §8

const LAYERS = {
  MDT: {
    prefix: 'MDT', order: 100,
    appliesCatalog: true,  appliesScTask: false, appliesReqItem: false, appliesTargetRecord: false,
  },
  VSB: {
    prefix: 'VSB', order: 200,
    appliesCatalog: true,  appliesScTask: true,  appliesReqItem: true,  appliesTargetRecord: true,
  },
  RO: {
    prefix: 'RO',  order: 300,
    appliesCatalog: true,  appliesScTask: false, appliesReqItem: false, appliesTargetRecord: false,
  },
  ROS: {
    prefix: 'ROS', order: 1000,
    appliesCatalog: false, appliesScTask: true,  appliesReqItem: true,  appliesTargetRecord: true,
  },
};

module.exports = {
  LAYERS,

  async create({
    shortDescription,
    catItemId,
    catalogConditions = '',   // correct field: catalog_conditions
    reverseIfFalse = false,
    active = true,
    order,
    appliesCatalog,
    appliesScTask,
    appliesReqItem,
    appliesTargetRecord,
    scope,
  } = {}) {
    const data = {
      short_description:     shortDescription,
      catalog_conditions:    catalogConditions,   // ← correct field name
      reverse_if_false:      reverseIfFalse,
      active,
      order,
      on_load:               true,
      run_scripts:           false,
      global:                true,
      isolate_script:        true,
      ui_type:               '0',
      va_supported:          true,
      applies_to:            'item',
      applies_catalog:       appliesCatalog,
      applies_sc_task:       appliesScTask,
      applies_req_item:      appliesReqItem,
      applies_target_record: appliesTargetRecord,
    };
    if (catItemId) data.catalog_item = catItemId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  // Create a per-variable UI Policy for a given layer type
  // catalogConditions: optional — set when variable has a "when" block
  // reverseIfFalse: auto-set to true when condition is present
  async createForVariable({ layerType, catItemId, variableName, catalogConditions = '', scope } = {}) {
    const layer = LAYERS[layerType];
    if (!layer) throw new Error(`Unknown layer type: ${layerType}. Use MDT, VSB, RO or ROS.`);

    return this.create({
      shortDescription:  `[${layer.prefix}] - [${variableName}]`,
      catItemId,
      catalogConditions,
      reverseIfFalse:    catalogConditions ? true : false,   // true when condition is present
      active: true,
      order:                layer.order,
      appliesCatalog:       layer.appliesCatalog,
      appliesScTask:        layer.appliesScTask,
      appliesReqItem:       layer.appliesReqItem,
      appliesTargetRecord:  layer.appliesTargetRecord,
      scope,
    });
  },

  // [ROS] — always one per item, covers all variables
  async createROS({ catItemId, itemName, scope } = {}) {
    const layer = LAYERS.ROS;
    return this.create({
      shortDescription:     `[ROS] - [${itemName}]`,
      catItemId,
      active: true,
      order:                layer.order,
      appliesCatalog:       layer.appliesCatalog,
      appliesScTask:        layer.appliesScTask,
      appliesReqItem:       layer.appliesReqItem,
      appliesTargetRecord:  layer.appliesTargetRecord,
      scope,
    });
  },

  // Build catalog_conditions string for "variable is not empty"
  buildConditionIsNotEmpty(variableSysId) {
    return `IO:${variableSysId}ISNOTEMPTY^EQ`;
  },

  async get(query = '', fields = 'sys_id,short_description,catalog_item,active,order') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) { return api.getOne(TABLE, sysId); },

  async getByCatItem(catItemId) {
    return api.get(TABLE, {
      sysparm_query: `catalog_item=${catItemId}`,
      sysparm_fields: 'sys_id,short_description,active,order',
      sysparm_orderby: 'order',
    });
  },

  async update(sysId, fields) { return api.update(TABLE, sysId, fields); },
};
