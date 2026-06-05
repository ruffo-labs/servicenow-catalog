# Alpar — ServiceNow Development Standards

Documento de referência para todos os artefatos ServiceNow desenvolvidos neste projeto.
**Todo desenvolvimento deve seguir estes padrões sem exceção.**

---

## 0. Update Sets — OBRIGATÓRIO ANTES DE QUALQUER CRIAÇÃO

Antes de criar qualquer artefato na instância:

1. Verificar os Update Sets em progresso (`sys_update_set` onde `state=in_progress`)
2. **Nunca usar o Default Update Set**
3. Perguntar ao usuário:
   - Deseja usar um Update Set existente? (listar os disponíveis)
   - Ou criar um novo?
4. Criar o Update Set se necessário e confirmar o `sys_id` com o usuário
5. O usuário deve definir o Update Set como corrente na instância antes de prosseguir

> ⚠️ Todos os registros criados via AI Bridge são rastreados no Update Set corrente do usuário logado na sessão.

---

## 1. Idioma

Todos os catalog items, variáveis, UI policies, scripts e identificadores devem ser criados em **inglês**.
A plataforma ServiceNow deve estar em **inglês** durante o desenvolvimento.

---

## 2. Aplicações (Scoped Apps)

Antes de criar uma nova aplicação com escopo:

1. Consultar `sys_app` verificando se já existe uma aplicação com o mesmo nome
2. **Se existir:** Perguntar ao usuário se deseja usar a aplicação existente ou criar uma nova
3. **Se não existir:** Confirmar a criação com o usuário antes de prosseguir

---

## 3. Catalog Item vs Record Producer

| Tabela | Tipo a criar | Tabela ServiceNow |
|---|---|---|
| `sc_req_item` | **Catalog Item** | `sc_cat_item` |
| Qualquer outra | **Record Producer** | `sc_cat_item_producer` |

> ⚠️ Nunca criar um Record Producer apontando para `sc_req_item`.

---

## 4. Campos Obrigatórios — Catalog Item / Record Producer

| Campo | Observação |
|---|---|
| `name` | Em inglês |
| `short_description` | Em inglês |
| `table_name` | Tabela alvo |
| Catalog (`sc_catalog`) | Verificar existência antes |
| Category **ou** Taxonomy | Ver §5 |

---

## 5. Categoria e Taxonomia

1. Consultar se o registro já existe pelo `title` / `name`
2. **Se existir:** Usar o `sys_id` do registro existente
3. **Se não existir:** Confirmar com o usuário antes de criar

---

## 6. Variáveis

### 6.1 Variáveis diretas no Catalog Item

| Regra | Detalhe |
|---|---|
| Prefixo do nome | `v_` (ex: `v_model`, `v_requested_for`) |
| Question text | Sem prefixo — legível para o usuário |
| Idioma | Inglês |
| Mandatory / Read Only / Visible | ❌ Nunca definir na variável — sempre via UI Policy |
| Auto-fill com usuário logado | Usar `default_value = "javascript:gs.getUserID()"` — **não** criar Client Script para isso |
| Placeholder / texto de exemplo | Usar `example_text` — campo correto em `item_option_new` ⚠️ o campo `hint` **não é gravável** via API |

### 6.1.1 Tipos de Variável (lista completa e correta)

| JSON type | ServiceNow label | Código |
|---|---|---|
| `yes_no` | Yes / No | `1` |
| `multi_line_text` | Multi Line Text | `2` |
| `multiple_choice` | Multiple Choice | `3` |
| `numeric_scale` | Numeric Scale | `4` |
| `select_box` | Select Box | `5` |
| `single_line_text` | Single Line Text | `6` |
| `checkbox` | CheckBox | `7` |
| `reference` | Reference | `8` |
| `date` | Date | `9` |
| `date_time` | Date/Time | `10` |
| `label` | Label | `11` |
| `break` | Break | `12` |
| `custom` | Custom | `14` |
| `ui_page` | UI Page | `15` |
| `wide_single_line_text` | Wide Single Line Text | `16` |
| `custom_with_label` | Custom with Label | `17` |
| `lookup_select_box` | Lookup Select Box | `18` |
| `container_start` | Container Start | `19` |
| `container_end` | Container End | `20` |
| `list_collector` | List Collector | `21` |
| `lookup_multiple_choice` | Lookup Multiple Choice | `22` |
| `html` | HTML | `23` |
| `container_split` | Container Split | `24` |
| `masked` | Masked | `25` |
| `email` | Email | `26` |
| `url` | URL | `27` |
| `ip_address` | IP Address | `28` |
| `duration` | Duration | `29` |
| `requested_for` | Requested For | `31` |
| `rich_text_label` | Rich Text Label | `32` |
| `attachment` | Attachment | `33` |
| `table_name` | Table Name | `40` |

### 6.2 Campo `reference` em variáveis do tipo Reference (type=8)

> ⚠️ O campo `reference` espera o **nome da tabela** (string), não o `sys_id` da tabela em `sys_db_object`.

```javascript
// ✅ Correto
reference: "sys_user"
reference: "cmdb_ci_service"

// ❌ Errado
reference: "e03bea02183232108bb255f46a373ab3"  // sys_id — não funciona
```

### 6.3 Variáveis dentro de Variable Set

| Regra | Detalhe |
|---|---|
| Prefixo do nome | `vs_` (ex: `vs_asset_tag`) |
| Mandatory / Read Only / Visible | ❌ Mesma regra — sempre via UI Policy |

---

## 7. Variable Sets

| Regra | Detalhe |
|---|---|
| Nome do registro | Descritivo e sem prefixo obrigatório (ex: `Hardware Information`) |
| Variáveis internas | Prefixo `vs_` |

### 7.1 Vincular Variable Set existente a um Catalog Item

Criar um registro na tabela **`io_set_item`** com os campos abaixo (confirmado via XML export):

| Campo | Valor |
|---|---|
| `sc_cat_item` | `sys_id` do catalog item |
| `variable_set` | `sys_id` do variable set ← campo correto (`item_option_new_set` **não existe**) |
| `order` | posição na tela (calculada automaticamente pela posição no array do JSON) |

```json
{ "variable_set": "sys_id_do_variable_set" }
```

> ⚠️ No JSON, uma entrada no array `variables` com a chave `variable_set` (sem `name`) indica vínculo — nunca criação de variável.

---

## 8. UI Policies — Arquitetura por Variável

### 8.1 Regra geral

Cada variável recebe sua **própria UI Policy record** por tipo de regra (MDT, VSB, RO).
Não compartilhar uma policy entre múltiplas variáveis (exceto [ROS]).

### 8.2 Nomenclatura

> Confirmado via XML export do ServiceNow — o campo `short_description` é o nome principal da tabela `catalog_ui_policy`. **Ambos** o prefixo e o nome da variável usam colchetes.

| Campo | Formato | Exemplo |
|---|---|---|
| `short_description` | `[PREFIX] - [variable_name]` | `[MDT] - [v_requested_for]` |

> ⚠️ Não existe campo `name` separado nesta tabela — `short_description` é o identificador exibido.

### 8.3 Lógica de criação por variável

Para cada variável no JSON, verificar `mandatory`, `visible` e `read_only`:

| Condição | Ação |
|---|---|
| `mandatory: true` | Criar `[MDT] - {variable_name}` |
| `visible: true/false` | Criar `[VSB] - {variable_name}` |
| `read_only: true` | Criar `[RO] - {variable_name}` |
| `ignore` em qualquer campo | **Não criar** a policy para aquele campo |
| Todos definidos | Criar os 3 records para aquela variável |

> A Camada 4 `[ROS]` **nunca** entra nessa lógica por variável — é sempre uma policy separada para todas as variáveis após o submit.

### 8.4 Quatro Camadas

---

#### Camada 1 — `[MDT]` Mandatory

| Propriedade | Valor |
|---|---|
| **short_description** | `[MDT] - [v_variable_name]` |
| **order** | `100` |
| `applies_catalog` | `true` |
| `applies_sc_task` | `false` |
| `applies_req_item` | `false` |
| `applies_target_record` | `false` |
| `applies_to` | `item` |
| `global` | `true` |
| `ui_type` | `0` |
| `va_supported` | `true` |
| `isolate_script` | `true` |

---

#### Camada 2 — `[VSB]` Visible

| Propriedade | Valor |
|---|---|
| **short_description** | `[VSB] - [v_variable_name]` |
| **order** | `200` |
| `applies_catalog` | `true` |
| `applies_sc_task` | `true` |
| `applies_req_item` | `true` |
| `applies_target_record` | `true` |
| `applies_to` | `item` |
| `global` | `true` |
| `ui_type` | `0` |

---

#### Camada 3 — `[RO]` Read Only (Catalog)

| Propriedade | Valor |
|---|---|
| **short_description** | `[RO] - [v_variable_name]` |
| **order** | `300` |
| `applies_catalog` | `true` |
| `applies_sc_task` | `false` |
| `applies_req_item` | `false` |
| `applies_target_record` | `false` |
| `applies_to` | `item` |
| `global` | `true` |

---

#### Camada 4 — `[ROS]` Read Only after Submit *(separada, uma por item)*

| Propriedade | Valor |
|---|---|
| **short_description** | `[ROS] - [item_name]` |
| **order** | `1000` |
| `applies_catalog` | `false` |
| `applies_sc_task` | `true` |
| `applies_req_item` | `true` |
| `applies_target_record` | `true` |
| `applies_to` | `item` |
| `global` | `true` |
| Escopo | Aplica a **todas** as variáveis do item |

---

### 8.5 Campo de Condition e Formato

> ⚠️ A condição deve ser salva no campo **`catalog_conditions`** (não `conditions`).

```
// Formato correto — "is not empty"
IO:{variable_sys_id}ISNOTEMPTY^EQ

// Exemplo real
IO:009a481883dd07d0b1a852e0deaad388ISNOTEMPTY^EQ

// Outros operadores
IO:{sys_id}ISEMPTY^EQ          // is empty
IO:{sys_id}={value}^EQ         // equals value
```

> ⚠️ ServiceNow armazena variáveis internamente com prefixo `IO:` — nunca usar apenas o `sys_id` ou o nome da variável.

### 8.6 Bloco `when` no JSON — Condição aplicada a todos os layers

Quando uma variável tem o bloco `when` no JSON, a condição é aplicada **a todos os layers cujo valor não seja `"ignore"`**, com `reverse_if_false = true`.

```json
{
  "name": "v_service_offering",
  "mandatory": "true",
  "visible": "true",
  "read_only": "ignore",
  "when": {
    "variable": "v_service",
    "condition": "is_not_empty"
  }
}
```

Resultado → 2 policies criadas, ambas com `catalog_conditions = IO:{v_service.sys_id}ISNOTEMPTY^EQ`:
- `[MDT] - [v_service_offering]` com condição
- `[VSB] - [v_service_offering]` com condição
- ~~`[RO]`~~ → `read_only: "ignore"` → não criada

**Mapeamento de condições:**

| JSON condition | catalog_conditions |
|---|---|
| `is_not_empty` | `IO:{sys_id}ISNOTEMPTY^EQ` |
| `is_empty` | `IO:{sys_id}ISEMPTY^EQ` |

---

## 9. UI Policy Actions

### 9.1 Campos obrigatórios (confirmado via XML export)

| Campo | Formato | Exemplo |
|---|---|---|
| `ui_policy` | `sys_id` da policy | `82065418831147d0b1a852e0deaad3e3` |
| `catalog_item` | `sys_id` do catalog item | `6f8ac41883dd07d0b1a852e0deaad3f3` |
| `catalog_variable` | `IO:{variable_sys_id}` | `IO:ff8a481883dd07d0b1a852e0deaad339` |
| `variable` | nome da variável (plain text) | `v_requested_for` |
| `mandatory` | `"true"` / `"false"` / `"ignore"` | |
| `visible` | `"true"` / `"false"` / `"ignore"` | |
| `disabled` | `"true"` / `"false"` / `"ignore"` | disabled = read only |
| `value_action` | `"ignore"` | sempre `"ignore"` |
| `cleared` | `"false"` | sempre `"false"` |
| `field_message_type` | `"none"` | sempre `"none"` |
| `order` | mesmo order da policy pai | `100`, `200`, `300` ou `1000` |

> ⚠️ Usar `"ignore"` (não `"leave"`) para campos que não devem ser alterados.

> ⚠️ `catalog_variable` deve usar o formato `IO:{sys_id}` — sem esse prefixo a variável não é encontrada.

> ⚠️ `catalog_item` é **obrigatório** — sem ele as variáveis não são resolvidas.

> ⚠️ `variable` (nome plain text) também é obrigatório — confirma qual variável a action controla.

---

## 10. Catalog Client Scripts

| Regra | Valor |
|---|---|
| `ui_type` | **Sempre `"10"` (All)** |
| Nomenclatura | `{Item Name} - {descrição da ação}` |
| Auto-fill simples | Usar `default_value = "javascript:gs.getUserID()"` na variável — não criar Client Script |
| Quando usar Client Script | Lógica que `default_value` não consegue expressar (onChange, lógica condicional, etc.) |

### Tipos disponíveis

| tipo | quando usar |
|---|---|
| `onLoad` | Executado ao abrir o formulário |
| `onChange` | Executado ao alterar o valor de uma variável |
| `onSubmit` | Executado ao submeter o formulário |
| `onCatalogLoad` | Executado ao carregar o catálogo |

## 11. Script Includes / Flows

Padrões ainda não definidos. Documento será atualizado quando as diretrizes forem estabelecidas.

---

## 12. JSON Schema — Padrão de criação de Catalog Items

Este é o schema oficial para envio de um item de catálogo para criação via AI Bridge.

```json
[
  {
    "table": "sc_req_item",
    "name": "Item Name",
    "short_description": "Short description in English",
    "description": "Full description in English",
    "catalog": "Service Catalog",
    "category": "Category Name",
    "keywords": "kw1,kw2,kw3",
    "variables": [

      // ── Variável simples (texto, multi-line, etc.)
      {
        "name": "v_field_name",
        "question": "Label for user",
        "type": "single_line_text",
        "mandatory": "true",
        "read_only": "ignore",
        "visible": "ignore",
        "example_text": "Placeholder shown inside the field"
      },

      // ── Variável reference (busca em tabela)
      {
        "name": "v_user",
        "question": "Select User",
        "type": "reference",
        "reference_table": "sys_user",
        "reference_qualifier": "active=true^sys_class_name=sys_user",
        "mandatory": "true",
        "read_only": "ignore",
        "visible": "ignore",
        "default_value": "javascript:gs.getUserID()"
      },

      // ── Variável com auto-populate (preenche de outra variável)
      {
        "name": "v_email",
        "question": "Email",
        "type": "single_line_text",
        "mandatory": "ignore",
        "read_only": "true",
        "visible": "ignore",
        "auto-populate": {
          "dynamic_value_field": "v_requested_for",
          "dynamic_value_dot_walk_path": "email"
        }
      },

      // ── Select box / Multiple choice com choices
      {
        "name": "v_importance",
        "question": "Importance",
        "type": "select_box",
        "mandatory": "true",
        "read_only": "ignore",
        "visible": "ignore",
        "choices": ["High", "Medium", "Low"]
      },

      // ── Choices com text ≠ value (formato objeto)
      {
        "name": "v_priority",
        "question": "Priority",
        "type": "multiple_choice",
        "mandatory": "true",
        "read_only": "ignore",
        "visible": "ignore",
        "choices": [
          { "text": "High Priority", "value": "high" },
          { "text": "Medium",        "value": "medium" },
          { "text": "Low",           "value": "low" }
        ]
      },

      // ── Variável condicional (bloco "when")
      {
        "name": "v_service_offering",
        "question": "Select Offering",
        "type": "reference",
        "reference_table": "service_offering",
        "reference_qualifier": "parent=javascript:current.variables.v_service",
        "mandatory": "true",
        "read_only": "ignore",
        "visible": "true",
        "when": {
          "variable": "v_service",
          "condition": "is_not_empty"
        }
      },

      // ── Variable Set existente (sem "name" — apenas vínculo)
      {
        "variable_set": "sys_id_do_variable_set"
      }

    ]
  }
]
```

### 12.1 Regras de campos das variáveis

| Campo JSON | Campo ServiceNow | Observação |
|---|---|---|
| `name` | `name` | Prefixo `v_` auto-aplicado |
| `question` | `question_text` | Label visível ao usuário |
| `type` | `type` | Ver §6.1.1 para códigos |
| `mandatory` / `read_only` / `visible` | UI Policy | Nunca na variável — ver §8 |
| `example_text` | `example_text` | Placeholder dentro do campo |
| `default_value` | `default_value` | `"javascript:gs.getUserID()"` para usuário logado |
| `reference_table` | `reference` | Nome da tabela (não sys_id) |
| `reference_qualifier` | `reference_qual` | Filtro da referência |
| `auto-populate.dynamic_value_field` | `dynamic_value_field` | Nome da variável fonte (convertido para sys_id) |
| `auto-populate.dynamic_value_dot_walk_path` | `dynamic_value_dot_walk_path` | Campo a buscar (ex: `"email"`) |
| `choices` | `question_choice` | Array de strings ou `{text, value}` — tabela separada |
| `when.variable` | `catalog_conditions` | Nome da variável gatilho (convertido para `IO:{sys_id}ISNOTEMPTY^EQ`) |
| `when.condition` | `catalog_conditions` | `is_not_empty` ou `is_empty` |
| `variable_set` | `io_set_item` | sys_id do Variable Set — order pela posição no array |

### 12.2 Tipos que suportam choices

| Tipo JSON | Código | Usar choices? |
|---|---|---|
| `select_box` | `5` | ✅ sim |
| `multiple_choice` | `3` | ✅ sim |
| `lookup_select_box` | `18` | ✅ sim |
| `lookup_multiple_choice` | `22` | ✅ sim |

> ⚠️ Para todos esses tipos, sempre setar `include_none = true` na variável — garante a opção em branco no dropdown.

### 12.3 Choices — tabela `question_choice`

| Campo | Valor |
|---|---|
| `question` | `sys_id` da variável |
| `text` | Texto exibido ao usuário |
| `value` | Valor armazenado (se omitido = igual ao `text`) |
| `order` | Auto: 100, 200, 300... pela posição no array |
| `inactive` | `"0"` (sempre ativo) |

---

## Checklist de criação

```
[ ] Update Set selecionado (nunca usar Default)
[ ] Idioma: inglês
[ ] Tipo correto: Catalog Item (sc_req_item) ou Record Producer (outras tabelas)
[ ] Campos obrigatórios: name, description, catalog, category/taxonomy
[ ] Categoria/Taxonomia: verificar existência antes de criar
[ ] Variáveis com prefixo v_ (diretas) ou vs_ (dentro de variable set)
[ ] Tipos de variável: usar lista §6.1.1 (single_line_text=6, email=26, etc.)
[ ] Campo reference: usar nome da tabela, não sys_id
[ ] Choices (select_box/multiple_choice): criar em question_choice após a variável
[ ] Choices simples: texto = valor | Choices objeto: { text, value }
[ ] Auto-fill com usuário logado: default_value="javascript:gs.getUserID()" na variável
[ ] Mandatory/Visible/ReadOnly NUNCA nas variáveis — sempre nas UI Policies
[ ] UI Policies: uma policy por variável por tipo de regra
[ ] Condition field: catalog_conditions (não conditions)
[ ] Condition formato: IO:{sys_id}ISNOTEMPTY^EQ
[ ] Bloco "when": aplica condição a todos os layers não-ignore da variável
[ ] catalog_variable no formato IO:{sys_id}
[ ] catalog_item preenchido em todas as actions
[ ] Valores ignorados = "ignore" (não "leave")
[ ] [ROS] criado separadamente para todas as variáveis
[ ] Client Script ui_type sempre "10" (All)
```
