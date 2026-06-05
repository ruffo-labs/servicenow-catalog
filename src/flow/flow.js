'use strict';

const api = require('../../utils/api-client');

// Flow Designer flows
// For classic Workflow use table: wf_workflow
const TABLE = 'sys_hub_flow';

// Key fields: name, description, active, trigger_type, internal_name,
// run_as ('user', 'requester', 'delegate'), sys_scope

module.exports = {
  TRIGGER_TYPES: {
    RECORD_BASED: 'record_based',
    SCHEDULE: 'schedule',
    MANUAL: 'manual',
    INBOUND_EMAIL: 'inbound_email',
    APPLICATION: 'application',
  },

  async create({
    name,
    description = '',
    active = true,
    triggerType = 'record_based',
    runAs = 'user',
    scope,
  } = {}) {
    const data = {
      name,
      description,
      active,
      trigger_type: triggerType,
      run_as: runAs,
    };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,active,trigger_type,run_as') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },

  async list(limit = 100) {
    return api.get(TABLE, { sysparm_limit: limit, sysparm_fields: 'sys_id,name,active,trigger_type' });
  },

  async activate(sysId) {
    return api.update(TABLE, sysId, { active: 'true' });
  },

  async deactivate(sysId) {
    return api.update(TABLE, sysId, { active: 'false' });
  },
};
