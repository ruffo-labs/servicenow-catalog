'use strict';

const api = require('../../utils/api-client');

const TABLE = 'sys_script_include';

// Key fields: name, api_name (e.g. x_scope.MyClass), script, description,
// active, client_callable, access ('package_private' or 'public'), sys_scope

function buildClassTemplate(name) {
  return `var ${name} = Class.create();
${name}.prototype = {
  initialize: function() {},

  type: '${name}'
};`;
}

module.exports = {
  buildClassTemplate,

  async create({
    name,
    script,
    description = '',
    active = true,
    clientCallable = false,
    access = 'package_private',
    scope,
    scopePrefix,
  } = {}) {
    const apiName = scopePrefix ? `${scopePrefix}.${name}` : name;
    const data = {
      name,
      api_name: apiName,
      script: script || buildClassTemplate(name),
      description,
      active,
      client_callable: clientCallable,
      access,
    };
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }
    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,api_name,active,client_callable') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async getByName(name) {
    return api.get(TABLE, {
      sysparm_query: `name=${name}`,
      sysparm_fields: 'sys_id,name,api_name,script,active',
    });
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },
};
