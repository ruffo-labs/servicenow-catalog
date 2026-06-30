'use strict';

const api = require('../../utils/api-client');

const TABLE = 'sys_update_set';

// Alpar Standard — Update Set:
//  - NEVER use the Default Update Set
//  - Always ask which update set to use or create a new one before any creation
//  - Call setCurrent() BEFORE creating any record to guarantee tracking
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
    const data = { name, description, state: 'in progress' };
    if (scope) { data.application = scope; data.sys_scope = scope; }
    return api.create(TABLE, data);
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  // Set the Update Set as current for the API user (alpar.ai) via sys_user_preference.
  // This guarantees all records created via AI Bridge go into the correct Update Set.
  async setCurrent(updateSetSysId) {
    const user = process.env.SERVICENOW_USER;

    // 1. Find the sys_id of the API user
    const userRes = await api.get('sys_user', {
      sysparm_query: `user_name=${user}`,
      sysparm_fields: 'sys_id,user_name',
      sysparm_limit: 1,
    });
    const userRecord = Array.isArray(userRes) ? userRes[0] : userRes?.result?.[0] ?? userRes;
    if (!userRecord?.sys_id) throw new Error(`Usuário "${user}" não encontrado em sys_user`);
    const userSysId = userRecord.sys_id;

    // 2. Check if the preference already exists
    const prefRes = await api.get('sys_user_preference', {
      sysparm_query: `user=${userSysId}^name=sys_update_set_current`,
      sysparm_fields: 'sys_id,value',
      sysparm_limit: 1,
    });
    const existing = Array.isArray(prefRes) ? prefRes[0] : prefRes?.result?.[0] ?? prefRes;

    if (existing?.sys_id) {
      // Update existing preference
      await api.update('sys_user_preference', existing.sys_id, { value: updateSetSysId });
    } else {
      // Create new preference
      await api.create('sys_user_preference', {
        user: userSysId,
        name: 'sys_update_set_current',
        value: updateSetSysId,
        type: 'string',
      });
    }

    return { ok: true, updateSetSysId, user };
  },

  // Helper: list and prompt — use before any creation workflow
  async selectOrCreate(name) {
    const existing = await this.listActive();
    return { existing, suggested: name };
  },
};
