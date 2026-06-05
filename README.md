# ServiceNow Catalog — PDI

Projeto para gerenciamento completo de Itens de Catálogo no ServiceNow via [AI Bridge REST API](docs/ai-bridge.md).

## Estrutura

| Componente | Tabela ServiceNow | Módulo |
|---|---|---|
| Catalog | `sc_catalog` | `src/catalog/catalog.js` |
| Category | `sc_category` | `src/catalog/category.js` |
| Taxonomy | `sn_cmt_taxonomy` | `src/catalog/taxonomy.js` |
| Record Producer | `sc_cat_item_producer` | `src/record-producer/record-producer.js` |
| Variable | `item_option_new` | `src/variables/variable.js` |
| Variable Set | `item_option_new_set` | `src/variables/variable-set.js` |
| Multirow Variable Set | `sc_multi_row_question_set` | `src/variables/multirow-variable-set.js` |
| UI Policy | `catalog_ui_policy` | `src/ui-policy/ui-policy.js` |
| UI Policy Action | `catalog_ui_policy_action` | `src/ui-policy/ui-policy-action.js` |
| Catalog Client Script | `catalog_script_client` | `src/catalog-client-script/catalog-client-script.js` |
| User Criteria | `user_criteria` | `src/user-criteria/user-criteria.js` |
| Script Include | `sys_script_include` | `src/script-include/script-include.js` |
| Flow | `sys_hub_flow` | `src/flow/flow.js` |

## Setup

### 1. Instalar o AI Bridge na instância ServiceNow

Veja instruções completas em [docs/ai-bridge.md](docs/ai-bridge.md).

### 2. Configurar credenciais

```bash
cp .env.example .env
```

Edite `.env`:
```
SERVICENOW_INSTANCE=https://devXXXXXX.service-now.com
SERVICENOW_USER=admin
SERVICENOW_PASSWORD=sua_senha
```

### 3. Instalar dependências

```bash
npm install
```

## Exemplo de uso

```javascript
const catalog = require('./src/catalog/catalog');
const category = require('./src/catalog/category');
const recordProducer = require('./src/record-producer/record-producer');
const variable = require('./src/variables/variable');

async function main() {
  // 1. Criar catálogo
  const sc = await catalog.create({
    title: 'Catálogo de TI',
    description: 'Serviços de TI',
  });

  // 2. Criar categoria
  const cat = await category.create({
    title: 'Hardware',
    catalogId: sc.sys_id,
  });

  // 3. Criar Record Producer
  const rp = await recordProducer.create({
    name: 'Solicitação de Notebook',
    shortDescription: 'Solicite um notebook corporativo',
    tableName: 'sc_req_item',
    categoryId: cat.sys_id,
  });

  // 4. Adicionar variável
  await variable.create({
    name: 'modelo',
    questionText: 'Qual modelo deseja?',
    type: variable.TYPES.SELECT_BOX,
    catItemId: rp.sys_id,
    mandatory: true,
  });

  console.log('Catálogo criado:', sc.sys_id);
}

main().catch(console.error);
```

## AI Bridge Skill

A skill do Claude Code está em `.claude/skills/servicenow-ai-bridge/`. Com ela ativa, Claude Code pode criar qualquer artefato ServiceNow diretamente na sua instância.
