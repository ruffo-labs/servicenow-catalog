'use strict';

const api = require('../../utils/api-client');

// Service Offering (`service_offering`) com o MESMO sys_id do export — as condições de UI Policy
// (IO:{service_offering}=<sys_id>) e os qualificadores de referência apontam para esses ids.
// Parent (Business Service, `cmdb_ci_service`) também é criado com o sys_id original.
// Não recriados: support_group, sla (grupos/SLAs não existem na instância) e campos u_* (colunas customizadas).

const unwrap = res => res?.result ?? res;

module.exports = {
  async create({ sys_id, name, short_description = '', description = '', parent, operational_status = '1', install_status = '1', used_for = 'Production' }) {
    if (parent?.sys_id) {
      await api.createWithSysId('cmdb_ci_service', { sys_id: parent.sys_id, name: parent.name, operational_status, install_status, used_for });
    }
    const data = { sys_id, name, short_description, description, operational_status, install_status, used_for };
    if (parent?.sys_id) data.parent = parent.sys_id;
    return unwrap(await api.createWithSysId('service_offering', data));
  },
};
