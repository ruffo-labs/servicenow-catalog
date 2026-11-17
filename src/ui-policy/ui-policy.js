'use strict';

const api = require('../../utils/api-client');
const { finder, resolveConditions, renameVars } = require('../../utils/resolve-names');

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
    // Idempotent per item: same short_description ("[MDT] - [v_name]") is never created twice
    const query = catItemId ? `catalog_item=${catItemId}^short_description=${shortDescription}` : null;
    return query ? api.createUnique(TABLE, query, data) : api.create(TABLE, data);
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

  // UI Policy do export (AS IS/TO BE), item ou set. As condições chegam com o NOME da variável entre chaves
  // (IO:{nome}...) porque o sys_id ainda não existia: aqui vira IO:<sys_id>. `vars` = { nome_na_instância: { id, name } }
  // (nome do export também casa com o prefixo v_/vs_ que os módulos de variável aplicam).
  // Condição com variável não resolvida → policy pulada; action com variável não resolvida → action pulada.
  async createFromExport(p, { catItemId, variableSetId, vars, renames, occ = 0, skipActions = false }) {   // occ: 2ª, 3ª… policy com a mesma short_description no mesmo dono
    const find = finder(vars);
    const { text: conditions, missing } = resolveConditions(p.conditions, vars);
    if (missing.length) return { skipped: `variável não encontrada na condição: ${missing.join(', ')}` };

    const data = {
      short_description:     p.short_description,
      catalog_conditions:    conditions,
      active:                p.active,
      order:                 p.order,
      on_load:               p.on_load,
      isolate_script:        p.isolate_script,
      ui_type:               p.ui_type,
      va_supported:          p.va_supported,
      applies_to:            catItemId ? 'item' : 'set',
      applies_catalog:       p.applies_catalog,
      applies_req_item:      p.applies_req_item,
      applies_sc_task:       p.applies_sc_task,
      applies_target_record: p.applies_target_record,
      ...p.extra,   // description, global, inherit, reverse_if_false, run_scripts, view (como no export)
      ...(p.script_true  && { script_true:  renameVars(p.script_true,  renames) }),
      ...(p.script_false && { script_false: renameVars(p.script_false, renames) }),
      ...(catItemId ? { catalog_item: catItemId } : { variable_set: variableSetId }),
    };
    const owner  = catItemId ? `catalog_item=${catItemId}` : `variable_set=${variableSetId}`;
    let policy;
    if (occ > 0) {   // descrição repetida: a n-ésima (por data de criação) é a policy desta ocorrência
      const rows = await api.get(TABLE, { sysparm_query: `${owner}^short_description=${p.short_description}^ORDERBYsys_created_on`, sysparm_fields: 'sys_id', sysparm_limit: occ + 1 });
      const list = Array.isArray(rows) ? rows : rows?.result || [];
      policy = list[occ] ? { result: { sys_id: list[occ].sys_id, _existed: true } } : await api.create(TABLE, data);
    } else policy = await api.createUnique(TABLE, `${owner}^short_description=${p.short_description}`, data);
    const sysId  = policy.result.sys_id;

    const warnings = [];
    let actions = 0;
    if (skipActions) return { sys_id: sysId, existed: !!policy.result._existed, actions, warnings };
    for (const a of p.actions) {
      const v = find(a.variable);
      if (!v) { warnings.push(`action ${a.variable}: variável não encontrada`); continue; }
      await api.createUnique('catalog_ui_policy_action', `ui_policy=${sysId}^variable=${v.name}`, {
        ui_policy:          sysId,
        catalog_variable:   `IO:${v.id}`,
        variable:           v.name,
        visible:            a.visible,
        mandatory:          a.mandatory,
        disabled:           a.disabled,
        cleared:            a.cleared,
        value:              a.value,
        value_action:       a.value_action,
        order:              a.order,
        field_message_type: 'none',
        ...(catItemId ? { catalog_item: catItemId } : { variable_set: variableSetId }),
      });
      actions++;
    }
    return { sys_id: sysId, existed: !!policy.result._existed, actions, warnings, skippedFields: policy.meta?.fields_skipped };
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
