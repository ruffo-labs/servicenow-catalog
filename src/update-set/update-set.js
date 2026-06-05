'use strict';

const api = require('../../utils/api-client');

const TABLE = 'sys_update_set';

// Alpar Standard — Update Set:
//  - NEVER use the Default Update Set
//  - Always ask which update set to use or create a new one before any creation
//  - The user must set the selected update set as current in the instance
//
// See: docs/standards/alpar-standards.md §0

module.exports = {
  // List all in-progress update sets (excludes Default)
  async listActive() {
    const res = await api.get(TABLE, {
      sysparm_query: 'state=in progress^nameNOT LIKEDefault',
      sysparm_fields: 'sys_id,name,description,state,sys_created_on',
      sysparm_orderby: 'sys_created_on',
      sysparm_order_direction: 'desc',
      sysparm_limit: 20,
    });
    return res?.result ?? res;
  },

  // Create a new update set
  async create({ name, description = '', scope } = {}) {
    const data = { name, description, state: 'in progress' };   // ServiceNow stores "in progress" (no underscore)
    if (scope) { data.application = scope; data.sys_scope = scope; }
    return api.create(TABLE, data);
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  // Helper: list and prompt — use before any creation workflow
  async selectOrCreate(name) {
    const existing = await this.listActive();
    return { existing, suggested: name };
  },
};
