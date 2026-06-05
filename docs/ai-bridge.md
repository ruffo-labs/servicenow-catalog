# ServiceNow AI Bridge

![I also like to live dangerously](assets/img.gif)

> **IMPORTANT: This is an experiment / prototype. Never use it against production instances.**
>
> The AI Bridge gives AI agents the ability to create and update ANY ServiceNow record. That means applications, tables, business rules, portals, script includes, scheduled jobs... everything. Use at your own risk on dev and sandbox instances only.

## What is this?

Here's the thing about ServiceNow: **everything is a record in a table**.

- An application? That's a record in `sys_app`
- A business rule? Record in `sys_script`
- A scheduled job? Record in `sysauto_script`
- A REST API? Record in `sys_ws_definition`
- A portal widget? Record in `sp_widget`

You get the idea. Tables all the way down.

So if an AI agent can create and update ANY record in ANY table... that agent can build anything. New apps, automation, integrations, portals - whatever you need.

**That's exactly what the AI Bridge does.** It's a simple REST adapter you install on your ServiceNow instance. Three endpoints. That's it.

The adapter uses GlideRecord under the hood, so it bypasses all the annoying Table API limitations (like records always going to global scope).

## How to set it up

**1. Install the update set on your ServiceNow instance**

1. Go to **System Update Sets > Retrieved Update Sets**
2. Click **Import Update Set from XML**
3. Upload the XML update set file
4. Preview and commit

Done. The adapter is now at:
```
https://YOUR_INSTANCE.service-now.com/api/1851835/ai_adapter_rest
```

**2. Copy the Claude Code skill to your project**

The skill is already at `.claude/skills/servicenow-ai-bridge/SKILL.md` in this project.

**3. Start asking Claude to build stuff**

Claude will ask for your instance URL and admin credentials when needed.

## API Reference

### Base URL
```
https://{instance}.service-now.com/api/1851835/ai_adapter_rest
```

### Authentication
Basic Auth with admin credentials.

### GET — Query Records
```
GET /api/1851835/ai_adapter_rest/{tableName}
```

Parameters: `sysparm_query`, `sysparm_fields`, `sysparm_limit`, `sysparm_offset`, `sys_id`

### POST — Create Record
```
POST /api/1851835/ai_adapter_rest/{tableName}
{ "data": { "field": "value", "sys_scope": "<scope_sys_id>" } }
```

### PUT — Update Record
```
PUT /api/1851835/ai_adapter_rest/{tableName}/{sysId}
{ "data": { "field": "new_value" } }
```

Update by query (use `_` as placeholder):
```
PUT /api/1851835/ai_adapter_rest/{tableName}/_?sysparm_query=name=x_myapp.prop
```

## Key Tables — Catalog

| Table | Purpose |
|---|---|
| `sc_catalog` | Service Catalog |
| `sc_category` | Category |
| `sc_cat_item` | Catalog Item |
| `sc_cat_item_producer` | Record Producer |
| `item_option_new` | Variable |
| `item_option_new_set` | Variable Set |
| `sc_multi_row_question_set` | Multirow Variable Set |
| `catalog_ui_policy` | UI Policy |
| `catalog_ui_policy_action` | UI Policy Action |
| `catalog_script_client` | Catalog Client Script |
| `user_criteria` | User Criteria |
| `sys_script_include` | Script Include |
| `sys_hub_flow` | Flow (Flow Designer) |
