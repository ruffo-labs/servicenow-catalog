'use strict';

const api = require('../../utils/api-client');

const TABLE = 'item_option_new';

// Alpar Standard — Variables:
//  - Name MUST start with "v_" (auto-applied if missing)
//  - question_text: human-readable label, NO prefix
//  - Language: English
//  - mandatory / read_only / visible: NEVER set here — always via UI Policy
//  - reference field: pass TABLE NAME (string), never sys_id
//  - default_value: use "javascript:gs.getUserID()" for auto-fill (no client script needed)
//  - example_text: placeholder text shown inside the input field (NOT "hint" — that field is not writable)
//
// See: docs/standards/alpar-standards.md §6

module.exports = {
  // Type map (key = JSON value, value = ServiceNow internal type number)
  TYPES: {
    yes_no:                 '1',
    multi_line_text:        '2',
    multiple_choice:        '3',
    numeric_scale:          '4',
    select_box:             '5',
    single_line_text:       '6',
    checkbox:               '7',
    reference:              '8',
    date:                   '9',
    date_time:              '10',
    label:                  '11',
    break:                  '12',
    custom:                 '14',
    ui_page:                '15',
    wide_single_line_text:  '16',
    custom_with_label:      '17',
    lookup_select_box:      '18',
    container_start:        '19',
    container_end:          '20',
    list_collector:         '21',
    lookup_multiple_choice: '22',
    html:                   '23',
    container_split:        '24',
    masked:                 '25',
    email:                  '26',
    url:                    '27',
    ip_address:             '28',
    duration:               '29',
    requested_for:          '31',
    rich_text_label:        '32',
    attachment:             '33',
    table_name:             '40',
  },

  async create({
    name,
    questionText,
    type = 'single_line_text',
    catItemId,
    variableSetId,
    active = true,
    order = 100,
    defaultValue = '',
    helpText = '',
    exampleText = '',    // placeholder inside the input field → example_text column
    referenceTable,
    referenceQualifier,
    dynamicValueField,        // sys_id of source variable (item_option_new)
    dynamicValueDotWalkPath,  // field to pull from reference (e.g. "email")
    scope,
  } = {}) {
    // Enforce v_ prefix
    const prefixedName = name.startsWith('v_') ? name : `v_${name}`;

    // Resolve type number
    const typeNum = this.TYPES[type] ?? type;

    const data = {
      name:          prefixedName,
      question_text: questionText,
      type:          typeNum,
      active,
      order,
    };

    if (defaultValue)            data.default_value              = defaultValue;
    if (helpText)                data.help_text                  = helpText;
    if (exampleText)             data.example_text               = exampleText;      // placeholder text
    // select_box and choice types: always include a blank "None" option
    if (['5', '3', '18', '22'].includes(typeNum)) data.include_none = true;
    if (referenceTable)          data.reference                  = referenceTable;   // table NAME, not sys_id
    if (referenceQualifier)      data.reference_qual             = referenceQualifier;
    if (dynamicValueField)       data.dynamic_value_field        = dynamicValueField;
    if (dynamicValueDotWalkPath) data.dynamic_value_dot_walk_path = dynamicValueDotWalkPath;
    if (catItemId)               data.cat_item                   = catItemId;
    if (variableSetId)           data.variable_set               = variableSetId;
    if (scope) { data.sys_scope = scope; data.sys_package = scope; }

    return api.create(TABLE, data);
  },

  async get(query = '', fields = 'sys_id,name,question_text,type,active,order') {
    return api.get(TABLE, { sysparm_query: query, sysparm_fields: fields });
  },

  async getById(sysId) {
    return api.getOne(TABLE, sysId);
  },

  async getByCatItem(catItemId) {
    return api.get(TABLE, {
      sysparm_query: `cat_item=${catItemId}`,
      sysparm_fields: 'sys_id,name,question_text,type,active,order',
      sysparm_orderby: 'order',
    });
  },

  async update(sysId, fields) {
    return api.update(TABLE, sysId, fields);
  },
};
