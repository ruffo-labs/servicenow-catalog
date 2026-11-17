'use strict';

const api = require('../../utils/api-client');

const TABLE = 'question_choice';

// Alpar Standard — Variable Choices:
//  - Used for select_box (5), multiple_choice (3), lookup_select_box (18)
//  - Table: question_choice
//  - Fields: question (variable sys_id), text, value, order, inactive
//  - Order auto-assigned: 100, 200, 300... by array position
//
// JSON formats accepted:
//   Simple array  → "choices": ["High", "Medium", "Low"]       (text = value)
//   Object array  → "choices": [{"text": "High", "value": "h"}] (text ≠ value)
//
// See: docs/standards/alpar-standards.md §6.4

module.exports = {
  // Create all choices for a variable from a JSON choices array
  // choices: string[] | { text: string, value?: string }[]
  async createAll(variableSysId, choices = []) {
    const results = [];
    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const text  = typeof choice === 'string' ? choice : choice.text;
      const value = typeof choice === 'string' ? choice : (choice.value ?? choice.text);
      const order = (typeof choice === 'object' && Number(choice.order)) || (i + 1) * 100;
      results.push(await this.create({ variableSysId, text, value, order, inactive: typeof choice === 'object' && choice.inactive ? '1' : '0' }));
    }
    return results;
  },

  async create({ variableSysId, text, value, order = 100, inactive = '0' } = {}) {
    // mesmo value com textos diferentes é válido no ServiceNow: a chave inclui o text ('^' escapado como '^^' na query)
    return api.createUnique(TABLE, `question=${variableSysId}^value=${value}^text=${String(text).replaceAll('^', '^^')}`, {
      question: variableSysId,
      text,
      value,
      order,
      inactive,        // '0' = ativa (padrão); '1' = inativa (vem do export)
    });
  },

  async getByVariable(variableSysId) {
    return api.get(TABLE, {
      sysparm_query:   `question=${variableSysId}^inactive=0`,
      sysparm_fields:  'sys_id,text,value,order',
      sysparm_orderby: 'order',
    });
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },
};
