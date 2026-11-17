# ServiceNow — Taxonomia (tópicos) e Categorias de catálogo

Referência técnica genérica, independente de cliente/instância. Vale para qualquer trabalho de recategorização de itens de catálogo via API.

## 1. Mapa das tabelas

| Conceito | Tabela | Campos que importam |
|---|---|---|
| Taxonomia (Employee Center) | `taxonomy` | raiz da árvore de tópicos |
| Tópico | `topic` | `name`, `description`, `taxonomy`, `template`, `parent_topic`, `active`, `order`, `icon` (user_image), `topic_path` (calculado) |
| Ligação conteúdo ↔ tópico | `m2m_connected_content` | `topic`, `catalog_item`, `content_type`, `order` |
| Tipo de conteúdo | `taxonomy_content_configuration` | registro "Catalog Item" (sys_id fixo por instância) usado em `content_type` |
| Categoria de catálogo | `sc_category` | `title`, `description`, `parent`, `sc_catalog`, `order`, `active`, `homepage_image`, `header_icon` (user_image), `homepage_renderer`, `mobile_*`, `location`, `roles` |
| Item de catálogo | `sc_cat_item` (Record Producer = `sc_cat_item_producer`) | `category` (uma só por item) |

- Hierarquia de tópicos: só pelo campo `parent_topic`. Hierarquia de categorias: só por `parent`.
- Um item tem **uma** categoria (`category`), mas pode ter **vários** tópicos (um registro de `m2m_connected_content` por tópico).

## 2. Tópicos — regras da plataforma

Business rules em `topic` que abortam o insert:

- **Prevent duplicate topic name**: o nome precisa ser **único na taxonomia inteira**, não só entre irmãos. A comparação ignora maiúscula/minúscula. O insert falha com `HTTP 500 — GlideRecord insert returned null` (sem detalhe do motivo).
- **Abort duplicate child topics**: dois filhos do mesmo pai não podem ter o mesmo nome.
- **Prevent invalid topic name**: sem espaço no início/fim e sem `/` no nome.

Consequência prática: ao criar muitos tópicos com nomes repetidos entre ramos, é preciso um **sufixo** só onde há colisão (com um tópico existente ou entre os novos), por exemplo `Nome (Ramo - Tipo)`. Nomes que já são únicos ficam sem sufixo. O `description` pode manter o nome sem sufixo.

Ao criar um tópico filho, copiar do pai: `taxonomy`, `template`. Definir `parent_topic`, `active`, `order`. `topic_path` é calculado por business rule assíncrona.

Para diagnosticar um 500 em insert: listar as business rules `before insert` da tabela (`sys_script` com `collection=<tabela>`) e ler o script. A mensagem da API não informa a causa.

## 3. Categorias — regras e cópia do pai

- Criar sempre com `parent`, `sc_catalog` (igual ao do pai), `title`, `order`, `active`.
- Copiar do pai o que existir: `homepage_renderer`, `mobile_subcategory_render_type`, `mobile_hide_description`, `roles`; `location` só se for um valor válido (alguns registros trazem a string literal `undefined`, que não deve ser copiada).
- Não existe regra de nome único: o mesmo título pode existir sob pais diferentes.
- `sc_category` é tabela **escopada** (grava `sys_scope`/`sys_package`); para criar no escopo correto, o usuário da API precisa estar com o aplicativo corrente certo (ver §6).
- A categoria final de um item = a **mais profunda** preenchida na estrutura (nível 4, senão 3, senão 2).

## 4. Ligação item ↔ tópico (`m2m_connected_content`)

- Campos: `topic`, `catalog_item`, `content_type` (registro "Catalog Item" de `taxonomy_content_configuration`), `order`.
- Idempotência: procurar por `topic` + `catalog_item` antes de criar.
- Para **trocar** a estrutura: calcular o conjunto desejado de tópicos por item, apagar os vínculos que não estão nele e criar os que faltam.
- Cuidado: nunca criar o vínculo com um tópico "a criar" (ainda sem sys_id). Um valor inválido no campo de referência é aceito pela API e fica gravado como lixo. Validar que o sys_id tem 32 hex antes de gravar e conferir depois que nenhum vínculo tem tópico inválido.
- Criar um vínculo dispara uma business rule assíncrona ("Change primary topic on content") que também atualiza o item. Isso pode gerar registros do item no update set corrente.

## 5. Ícones e imagens (campos `user_image`)

`topic.icon`, `sc_category.homepage_image` e `sc_category.header_icon` são do tipo `user_image`: o valor é o **sys_id de um anexo** (`sys_attachment`) preso ao próprio registro, com `table_name` = `ZZ_YY<tabela>` (por exemplo `ZZ_YYtopic`, `ZZ_YYsc_category`).

- **Um anexo não pode ser compartilhado entre dois registros.** Para repetir uma imagem, é preciso baixar o conteúdo e subir uma **cópia** no registro de destino.
- Cópia: `GET /api/now/attachment/<sys_id>/file` (baixar) → `POST /api/now/attachment/file?table_name=ZZ_YY<tabela>&table_sys_id=<destino>&file_name=<nome>.png` com o `Content-Type` do original → atualizar o campo do destino com o `sys_id` do novo anexo.
- O upload rejeita nome **sem extensão** (`is not an authorized file extension`). O arquivo original pode se chamar só `icon`; a cópia deve levar `.png` (ou a extensão do tipo).
- O AI Bridge não cobre anexos: usar a Table/Attachment API padrão com a mesma autenticação.
- A atualização do campo entra no update set como registro do tópico/categoria; confirmar na exportação que o anexo acompanha.

### Casando registros novos com registros antigos que já têm imagem
- Normalizar o nome base: sem acento, minúsculas, sem parênteses no fim, sem espaço duplicado.
- Exigir o **mesmo ramo/raiz** (por exemplo, o mesmo lado da estrutura) para não pegar imagem de outra árvore.
- Se houver mais de um candidato, preferir o ativo; se ainda sobrar mais de um, **não adivinhar**: listar para decisão (ou pegar o primeiro, se o usuário autorizar).
- Casar por igualdade de `title` pode falhar quando o texto vem de planilha (caracteres invisíveis); usar `STARTSWITH`/`LIKE` como alternativa.

## 6. Update sets e escopos

- Cada tabela vai para o update set do **seu** escopo: tópicos no escopo da taxonomia; categorias e itens no escopo do aplicativo de catálogo; ligações m2m no Global.
- Selecionar antes de gravar: preferência `sys_update_set` (update set) **e** `apps.current_app` (aplicativo). Sem isso o registro cai no update set padrão ou no escopo errado.
- **Não são rastreados** quando gravados pelo usuário de integração: tabelas globais como `m2m_connected_content`, grupos, roles, membros e `service_offering`. Os registros ficam na instância mas não entram no update set. Alternativas: salvar o registro pela interface com o update set certo, ou rodar em Scripts - Background `new GlideUpdateManager2().saveRecord(gr)` para cada registro.
- **Deleção feita por API também não é rastreada.** Para levar a remoção a outro ambiente, rodar um fix script com `deleteRecord()` por sys_id (os ids removidos ficam em `sys_audit_delete`, filtrando por `tablename`, criador e janela de tempo).
- Registros de tabelas escopadas (`topic`, `sc_category`, itens) **são** rastreados, mesmo gravados por API, desde que o update set e o aplicativo correntes estejam corretos. Conferir sempre em `sys_update_xml` (`update_set=<id>`, paginando de 1000 em 1000).
- Em lote com update set "pai" Global e filhos por escopo, cada filho recebe só o que pertence ao seu escopo.

## 7. Limitações do AI Bridge (API usada nos scripts)

- `sys_id` enviado no POST é ignorado (o ServiceNow gera outro). Quando o sys_id precisa ser preservado, usar a Table API padrão.
- **DELETE não é suportado** pelo AI Bridge; usar `DELETE /api/now/table/<tabela>/<sys_id>`.
- Erros de business rule chegam como `HTTP 500` genérico.
- Para tabelas escopadas, o cliente injeta `sys_scope`/`sys_package` quando um escopo está configurado; tabelas globais ficam no aplicativo corrente do usuário.

## 8. Receita de uma recategorização completa

1. Ler a planilha (cada linha = caminho de tópicos + caminho de categorias + item).
2. Resolver cada linha para **um** item (oferta + nome do item + ramo). Linhas sem item único são listadas e puladas.
3. Criar os tópicos faltantes, nível a nível (pai antes do filho), com sufixo só onde há colisão de nome. Update set do escopo da taxonomia.
4. Criar as categorias faltantes, nível a nível, copiando do pai. Update set do escopo do catálogo.
5. Gravar `category` nos itens (categoria mais profunda). Mesmo update set do passo 4.
6. Trocar as ligações m2m (apagar as antigas, criar as novas). Update set Global; lembrar que não é rastreado (§6).
7. Copiar imagens/ícones dos registros antigos equivalentes para os novos (§5).
8. Verificar: segunda rodada de cada passo deve dar **zero** a fazer; contar vínculos por item; conferir `sys_update_xml`.

Todos os passos devem rodar em simulação por padrão (`--apply` para gravar) e ser idempotentes (consultar por chave natural antes de criar).
