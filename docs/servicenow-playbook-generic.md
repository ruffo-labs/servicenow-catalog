# Playbook genérico — o que serve para qualquer ambiente ServiceNow

Aprendizados e receitas deste projeto que **não dependem do cliente nem da instância**. Taxonomia e categorias estão em `servicenow-taxonomy-categories.md`; este arquivo cobre o resto.

## 1. SLA Definitions (`contract_sla`) em lote

Objetivo: criar uma SLA Definition por combinação **SLA × tabela de destino**, a partir de uma tabela de apoio com o prazo (`sla`) e de um registro-molde.

### Entradas
- **Tabela de apoio** (`sla`): um registro por SLA, com o prazo no **final do nome** (`... 24H`, `... 5D`). Filtrar por prefixo do nome e excluir números indevidos.
- **Molde**: um `contract_sla` já configurado corretamente (condições de cancelar/pausar/retomar/parar, schedule, workflow, timezone, tipo, target…).
- **Lista de tabelas** onde a SLA deve rodar (`collection`). Conferir a lista **antes**: uma tabela errada (ex.: incident no lugar de uma tabela do aplicativo) gera SLA no lugar errado.

### Regras
- Copiar do molde só os campos de comportamento (`cancel_condition`, `schedule`, `workflow`, `pause_condition`, `resume_condition`, `stop_condition`, `type`, `target`, `timezone_source`, `schedule_source`, `retroactive_pause`, `relative_duration_works_on`, `reset_action`, `when_to_cancel`, `when_to_resume`, `active`, `adv_condition_type`). Mudam por registro: `name`, `collection`, `duration`, `start_condition`.
- **Duração**: o campo é data/hora duração, guardado como `1970-01-01 00:00:00 + tempo` em UTC. Ex.: 24H → `1970-01-02 00:00:00`; `D` (dias) vira horas ×24. Conferir um registro existente para validar o formato antes de gravar em massa.
- **Gatilho**: `start_condition = state=1^service_offering.sla=<sys_id da SLA>^EQ` (dot-walk pela oferta do registro). Cada **tabela** não pode ter dois definitions com o mesmo gatilho; nome repetido é aceitável.
- **Nome**: derivado do nome da SLA de apoio com um prefixo do projeto; manter coerente com o nome do registro de apoio (corrigir acentos/grafia aqui, não no apoio).
- **Idempotência**: pular quando já existe `contract_sla` na mesma `collection` cujo `start_condition` contém o mesmo `service_offering.sla=<sys_id>`.
- `contract_sla` é **escopada**: gravar com o aplicativo/escopo correto (e update set do escopo) selecionado.
- Se uma SLA de apoio **nova** substituir uma antiga, criar o novo gatilho e desativar o velho manualmente (não apagar): dois gatilhos iguais para a mesma tabela disparam duas SLAs.

### Verificação
Rodar o plano (sem `--apply`) e conferir: nº de SLAs × nº de tabelas = nº a criar; um registro de exemplo com duração, tabela e gatilho corretos; segunda execução = 0 a criar.

## 2. User Criteria (Available for / Not available for) em itens

- Tabelas de ligação: `sc_cat_item_user_criteria_mtom` (disponível para) e `sc_cat_item_user_criteria_no_mtom` (não disponível para); campos `sc_cat_item` e `user_criteria`. Ambas são **escopadas**.
- Fonte: lista do export; se o export não trouxer, **copiar do item de origem**. Só acrescentar (nunca remover) e não duplicar (comparar com o que já existe no item).
- A categoria do item novo pode ser a do item de origem (`category`), via o registro do Record Producer.

## 3. Grupos, roles e ofertas (de-para)

Padrão para "criar grupos novos copiando de grupos existentes e apontar as ofertas para eles":
- Grupo novo: copiar `manager`, `parent`, `type`, `description`, `active` e campos customizados do primeiro grupo de origem; **roles** (`sys_group_has_role`) e **membros** (`sys_user_grmember`) = união dos grupos de origem.
- Grupo de destino que já existe **não é alterado**.
- Oferta (`service_offering.support_group`) localizada por nome e, se houver homônimas, pelo item ligado (`u_catalog_items`). Guardar backup do valor anterior antes de alterar.
- Linhas sem origem resolvida: **só listar**, sem tocar na oferta. Casos ambíguos: decidir uma regra (todas as candidatas, ou listar) e aplicar igual a todos.
- Atenção: grupos, roles, membros e ofertas escritos pela integração **não entram em update set** (ver `servicenow-taxonomy-categories.md` §6).

## 4. UI Policies de catálogo — regras que valem sempre

### Estrutura
- `catalog_ui_policy` (`catalog_item` ou `variable_set` + `applies_to`) e `catalog_ui_policy_action` (`catalog_variable = IO:<sys_id da variável ou do set>`, `variable`, `visible`, `mandatory`, `disabled`).
- Condição em `catalog_conditions`: `IO:<sys_id>ISNOTEMPTY`, `IO:<id>=valor`, `^OR`, `^NQ` (novo grupo), terminando com `^EQ`.
- `reverse_if_false` inverte `true/false` das ações, **não** o `ignore`.
- `on_load` precisa estar true para a policy valer na abertura do formulário.
- **Ordem**: policy com `order` maior roda depois e vence. Uma policy sem condição que põe `mandatory=true` num campo **o torna visível**, mesmo que outra tenha escondido antes. Policies de visibilidade devem ter order **maior** que as incondicionais (ex.: 200 contra 100).
- Policy de variable set com ação em `IO:<sys_id do set>` controla a visibilidade do set inteiro; ação na variável controla só aquela variável. Para forçar `mandatory=false` ao esconder, é preciso uma ação com `mandatory=true` + `reverse_if_false`.

### Receita "mostrar só depois de escolher a oferta"
- Policy própria: condição `service_offering ISNOTEMPTY`, `reverse_if_false=true`, `on_load=true`, order acima das demais.
- Ação `visible=true`, `mandatory=true` (ou `ignore` quando a obrigatoriedade deve ser a da variável). Isso esconde e tira a obrigatoriedade enquanto a oferta estiver vazia.
- Variáveis que nunca aparecem em nenhuma oferta do item podem ser **inativadas**.
- Quando uma regra existente já controla o campo, **concatenar** a condição (oferta preenchida + regra original), com a oferta repetida em cada grupo `^NQ`.

### Labels e ajuda
- Copiar **exatamente** os cinco campos de ajuda do item de origem: `show_help`, `show_help_on_load`, `help_tag`, `help_text`, `instructions` (sem inferir um pelo outro). `instructions` é o texto que aparece na tela.
- Label cujas regras só valem para ofertas que o item novo não tem **não** é recriado.
- Policy que esconde label (visible=false) não deve ser replicada: após o reverse ela mostraria o label antes da hora.

### Variable set com anexos obrigatórios
- Policy própria por item: visível + obrigatório só depois da oferta, usando a condição da origem. Se a origem não mostra o set para as ofertas do item (ou não tem regra), criar uma policy "oculta por padrão" (sem condição, `visible=false`, `mandatory=false`). Validar isso sempre que o set estiver presente.

### Campo `applies_target_record`
- Policies com `applies_req_item=true` (rodam no item solicitado) precisam também de `applies_target_record=true` quando o item grava em uma **tabela alvo** (Record Producer): sem isso, não rodam no registro de destino. Não é necessário remover o `applies_req_item`.

## 5. Traduções de campos (`sys_translated_text`)

- Chaves: `tablename`, `documentkey` (sys_id do registro), `fieldname`, `language`.
- Para alinhar tradução ao registro: ler o valor atual do campo no registro e gravar o mesmo valor na tradução; valor vazio no registro → tradução vazia.
- A alteração entra no update set como o **registro-pai** (`<tabela>_<sys_id>`), não como linha da tabela de tradução.
- Campos HTML: o servidor grava `"` como `&#34;` e `>` como `&gt;`; comparar decodificado.

## 6. Cuidados gerais de scripts de carga

- **Sempre dry-run por padrão**, `--apply` para gravar; rodar a segunda execução e exigir zero pendências.
- **Validar existência antes de criar** (`createUnique` por chave natural); nunca assumir banco vazio.
- Gravar sempre com o **update set e o aplicativo corretos** selecionados; confirmar em `sys_update_xml` (paginado) que os registros entraram.
- Executar em **lotes paralelos** só quando os itens são independentes; um log por item e um resumo por lote (código de saída + contagem de sucessos/erros).
- Funções de formatação defensivas: nomes vindos de export podem ser `null`.
- Shell: evitar `String.replace` com padrões `$` e heredocs com barras invertidas ao gerar código; preferir editar com ferramentas de arquivo.
- Itens-teste/rascunho criados para diagnosticar devem ser apagados no fim (Table API, pois o AI Bridge não faz DELETE).
- Credenciais em `.env` não devem ir para o git; rotacionar antes de qualquer commit.
