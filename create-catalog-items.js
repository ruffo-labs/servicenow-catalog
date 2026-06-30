'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const api             = require('./utils/api-client');
const catalogModule   = require('./src/catalog/catalog');
const category        = require('./src/catalog/category');
const variable        = require('./src/variables/variable');
const questionChoice  = require('./src/variables/question-choice');
const uiPolicy        = require('./src/ui-policy/ui-policy');
const uiPolicyAction  = require('./src/ui-policy/ui-policy-action');

const JSON_PATH = 'C:\\Pipo\\DEV\\excel-to-json\\excel-to-json\\Exemplo Preenchimento Para IA.json';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Empty string / null / undefined → "ignore"
function normBool(val) {
  if (val === undefined || val === null || val === '') return 'ignore';
  return val;
}

// Build catalog_conditions string from JSON condition type + variable sys_id
function buildCondition(conditionType, variableSysId) {
  if (conditionType === 'is_not_empty') return `IO:${variableSysId}ISNOTEMPTY^EQ`;
  if (conditionType === 'is_empty')     return `IO:${variableSysId}ISEMPTY^EQ`;
  return '';
}

// Safely unwrap AI Bridge list response (GET)
function unwrapList(res) {
  if (Array.isArray(res))                   return res;
  if (res && Array.isArray(res.result))     return res.result;
  return [];
}

// Safely unwrap AI Bridge create response (POST)
// The AI Bridge wraps POST responses in an extra "result" layer:
//   { result: { sys_id: "abc123", ... }, meta: { ... } }
// So data.result (returned by api-client) = { result: { sys_id }, meta: {...} }
// and we need to unwrap one more level.
function unwrapCreate(res) {
  if (!res) return {};
  if (res.result && typeof res.result === 'object' && !Array.isArray(res.result)) {
    return res.result;
  }
  return res;
}

// ── Per-item creation ─────────────────────────────────────────────────────────

async function createItem(item) {
  const isScReqItem = item.table === 'sc_req_item';
  const catTable    = isScReqItem ? 'sc_cat_item' : 'sc_cat_item_producer';
  const typeName    = isScReqItem ? 'Catalog Item (sc_cat_item)' : `Record Producer (${item.table})`;

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  ${item.name}`);
  console.log(`║  ${typeName}`);
  console.log(`╚══════════════════════════════════════════════════════╝`);

  // ── 1. Find Catalog ──────────────────────────────────────────────────────────
  console.log(`\n[1/7] Buscando catálogo "${item.catalog}"...`);
  const catalogRes     = await catalogModule.get(`title=${item.catalog}`, 'sys_id,title');
  const catalogRecords = unwrapList(catalogRes);
  if (catalogRecords.length === 0) throw new Error(`Catálogo "${item.catalog}" não encontrado.`);
  const catalogId = catalogRecords[0].sys_id;
  console.log(`       ✅ sys_id: ${catalogId}`);

  // ── 2. Find or Create Category ──────────────────────────────────────────────
  console.log(`\n[2/7] Buscando/criando categoria "${item.category}"...`);
  const cat        = await category.findOrCreate({ title: item.category, catalogId });
  const categoryId = cat.sys_id;
  console.log(`       ${cat._existed ? '✅ Existente' : '✅ Criada'}  sys_id: ${categoryId}`);

  // ── 3. Catalog Item / Record Producer (findOrCreate) ────────────────────────
  console.log(`\n[3/7] Buscando/criando ${typeName}...`);

  // sc_cat_item_producer extends sc_cat_item — query sc_cat_item covers both
  const existingRes     = await api.get('sc_cat_item', {
    sysparm_query:  `name=${item.name}`,
    sysparm_fields: 'sys_id,name',
    sysparm_limit:  1,
  });
  const existingRecords = unwrapList(existingRes);

  let catItemId;
  if (existingRecords.length > 0) {
    catItemId = existingRecords[0].sys_id;
    console.log(`       ✅ Existente  sys_id: ${catItemId}`);
  } else {
    const catData = {
      name:              item.name,
      short_description: item.short_description,
      description:       item.description,
      active:            true,
      category:          categoryId,
    };
    if (!isScReqItem) catData.table_name = item.table;

    const catItem = unwrapCreate(await api.create(catTable, catData));
    catItemId     = catItem.sys_id;
    console.log(`       ✅ Criado  sys_id: ${catItemId}`);
  }

  // ── 4. Variables ─────────────────────────────────────────────────────────────
  console.log(`\n[4/7] Criando variáveis...`);
  const varSysIds = {};   // varName → sys_id
  let order = 100;

  for (const v of item.variables) {

    // Variable Set link (entry without "name")
    if (v.variable_set && !v.name) {
      console.log(`   📎 Vinculando Variable Set ${v.variable_set}...`);
      const link = unwrapCreate(await api.create('io_set_item', {
        sc_cat_item:  catItemId,
        variable_set: v.variable_set,
        order,
      }));
      order += 100;
      console.log(`      ✅ io_set_item sys_id: ${link.sys_id}`);
      continue;
    }

    // Resolve auto-populate: dynamic_value_field name → sys_id
    let dynamicValueField;
    let dynamicValueDotWalkPath;
    if (v['auto-populate']) {
      const srcName           = v['auto-populate'].dynamic_value_field;
      dynamicValueField       = varSysIds[srcName];           // already created above
      dynamicValueDotWalkPath = v['auto-populate'].dynamic_value_dot_walk_path;
    }

    console.log(`\n   🔧 ${v.name}  [${v.type}]`);
    const created = unwrapCreate(await variable.create({
      name:                    v.name,
      questionText:            v.question,
      type:                    v.type,
      catItemId,
      order,
      referenceTable:          v.reference_table,
      referenceQualifier:      v.reference_qualifier,
      dynamicValueField,
      dynamicValueDotWalkPath,
      defaultValue:            v.default_value,
    }));

    varSysIds[v.name] = created.sys_id;
    order += 100;
    console.log(`      ✅ sys_id: ${created.sys_id}`);

    // Choices (select_box / multiple_choice)
    if (v.choices && v.choices.length > 0) {
      console.log(`      🗂️  Criando ${v.choices.length} choices...`);
      await questionChoice.createAll(created.sys_id, v.choices);
      console.log(`      ✅ Choices criadas`);
    }
  }

  // ── 5. UI Policies ───────────────────────────────────────────────────────────
  console.log(`\n[5/7] Criando UI Policies...`);
  const policyIds = {};   // "LAYER:varName" → sys_id

  for (const v of item.variables) {
    if (!v.name) continue;

    const mandatory = normBool(v.mandatory);
    const readOnly  = normBool(v.read_only);
    const visible   = normBool(v.visible);

    // "when" block → condition applied to all non-ignore layers
    let catalogConditions = '';
    if (v.when) {
      const condSysId = varSysIds[v.when.variable];
      if (condSysId) catalogConditions = buildCondition(v.when.condition, condSysId);
    }

    if (mandatory !== 'ignore') {
      const pol = unwrapCreate(await uiPolicy.createForVariable({ layerType: 'MDT', catItemId, variableName: v.name, catalogConditions }));
      policyIds[`MDT:${v.name}`] = pol.sys_id;
      console.log(`   ✅ [MDT] - [${v.name}]  ${pol.sys_id}`);
    }

    if (visible !== 'ignore') {
      const pol = unwrapCreate(await uiPolicy.createForVariable({ layerType: 'VSB', catItemId, variableName: v.name, catalogConditions }));
      policyIds[`VSB:${v.name}`] = pol.sys_id;
      console.log(`   ✅ [VSB] - [${v.name}]  ${pol.sys_id}`);
    }

    if (readOnly !== 'ignore') {
      const pol = unwrapCreate(await uiPolicy.createForVariable({ layerType: 'RO',  catItemId, variableName: v.name, catalogConditions }));
      policyIds[`RO:${v.name}`]  = pol.sys_id;
      console.log(`   ✅ [RO]  - [${v.name}]  ${pol.sys_id}`);
    }
  }

  // ROS — one per item, covers all variables after submit
  const rosPolicy = unwrapCreate(await uiPolicy.createROS({ catItemId, itemName: item.name }));
  console.log(`   ✅ [ROS] - [${item.name}]  ${rosPolicy.sys_id}`);

  // ── 6. UI Policy Actions ─────────────────────────────────────────────────────
  console.log(`\n[6/7] Criando UI Policy Actions...`);

  for (const v of item.variables) {
    if (!v.name) continue;

    const mandatory = normBool(v.mandatory);
    const readOnly  = normBool(v.read_only);
    const visible   = normBool(v.visible);
    const varSysId  = varSysIds[v.name];

    if (policyIds[`MDT:${v.name}`]) {
      await uiPolicyAction.create({
        uiPolicyId:    policyIds[`MDT:${v.name}`],
        catItemId,
        variableSysId: varSysId,
        variableName:  v.name,
        mandatory,
        visible:       'ignore',
        disabled:      'ignore',
        order:         100,
      });
      console.log(`   ✅ Action MDT → ${v.name}`);
    }

    if (policyIds[`VSB:${v.name}`]) {
      await uiPolicyAction.create({
        uiPolicyId:    policyIds[`VSB:${v.name}`],
        catItemId,
        variableSysId: varSysId,
        variableName:  v.name,
        mandatory:     'ignore',
        visible,
        disabled:      'ignore',
        order:         200,
      });
      console.log(`   ✅ Action VSB → ${v.name}`);
    }

    if (policyIds[`RO:${v.name}`]) {
      await uiPolicyAction.create({
        uiPolicyId:    policyIds[`RO:${v.name}`],
        catItemId,
        variableSysId: varSysId,
        variableName:  v.name,
        mandatory:     'ignore',
        visible:       'ignore',
        disabled:      readOnly,
        order:         300,
      });
      console.log(`   ✅ Action RO  → ${v.name}`);
    }
  }

  // ── 7. ROS Actions (all variables → disabled=true after submit) ──────────────
  console.log(`\n[7/7] Criando ROS Actions para todas as variáveis...`);
  for (const v of item.variables) {
    if (!v.name) continue;
    await uiPolicyAction.create({
      uiPolicyId:    rosPolicy.sys_id,
      catItemId,
      variableSysId: varSysIds[v.name],
      variableName:  v.name,
      mandatory:     'ignore',
      visible:       'ignore',
      disabled:      'true',
      order:         1000,
    });
    console.log(`   ✅ ROS Action → ${v.name}`);
  }

  console.log(`\n🎉  "${item.name}" criado com sucesso!  sys_id: ${catItemId}`);
  return { name: item.name, sys_id: catItemId, type: typeName };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const json  = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const items = json.items;

  console.log(`\n🚀  Iniciando criação de ${items.length} Catalog Items no ServiceNow...\n`);

  const results = [];
  for (const item of items) {
    const result = await createItem(item);
    results.push(result);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅  RESUMO FINAL                                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  for (const r of results) {
    console.log(`  📦  ${r.name}`);
    console.log(`       sys_id : ${r.sys_id}`);
    console.log(`       tipo   : ${r.type}`);
  }
  console.log('\n🎉  Todos os itens criados com sucesso!\n');
}

main().catch(err => {
  console.error('\n❌  Erro fatal:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
