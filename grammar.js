/**
 * @file Axel grammar for tree-sitter
 * @author JinWatanabe
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  PAREN_DECLARATOR: -10,
  ASSIGNMENT: -2,
  STRUCTURED_BINDING: -1,
  CONDITIONAL: -1,
  DEFAULT: 0,
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  INCLUSIVE_OR: 3,
  EXCLUSIVE_OR: 4,
  BITWISE_AND: 5,
  EQUAL: 6,
  RELATIONAL: 7,
  THREE_WAY: 8,
  OFFSETOF: 8,
  SHIFT: 9,
  ADD: 10,
  MULTIPLY: 11,
  CAST: 12,
  SIZEOF: 13,
  UNARY: 14,
  CALL: 15,
  NEW: 16,
  FIELD: 16,
  SUBSCRIPT: 17,
};

module.exports = grammar({
  name: "axel",

  conflicts: $ => [
    [$._class_definition, $.obj_name],
    [$._class_definition, $.direct_declarator],
    [$._class_definition],
    [$.obj_name],
    [$.direct_declarator],
    [$.parameter_declaration],
    [$.abstruct_pointer_declarator, $.pointer_declarator],
    [$.abstruct_pointer_declarator],
    [$.classref, $.obj_name],
    [$.classref],
    [$.direct_declarator, $.gins_def],
    [$._class_definition, $.gins_def],
    [$.command_statement],
  ],

  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  inline: $ => [
    $._class_name,
    $._gtop_class,
    $._gins_class,
    $._assignment_left_expression,
  ],

  supertypes: $ => [
    $.expression,
    $.statement,
    $._declarator,
    $.abstruct_declarator,
  ],

  word: $ => $.identifier,

  rules: {
    translation_unit: $ => repeat($._context),

    _context: $ => choice(
      $.compound_statement,
      $.func_def,
      $.object_definition,
      $.type_def,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_include,
      $.preproc_using,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
    ),

    _block_item: $ => choice(
      $.statement,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_include,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
    ),

    // Preprocesser

    preproc_include: $ => seq(
      preprocessor('include'),
      field('path', choice(
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token.immediate(/\r?\n/),
    ),

    preproc_using: $ => seq(
      preprocessor('using'),
      field('path', choice(
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token.immediate(/\r?\n/),
    ),

    preproc_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_function_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('parameters', $.preproc_params),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_params: $ => seq(
      token.immediate('('), commaSep(choice($.identifier, '...')), ')',
    ),

    preproc_call: $ => seq(
      field('directive', $.preproc_directive),
      field('argument', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    ...preprocIf('', $ => $._block_item),
    ...preprocIf('_in_field_declaration_list', $ => $._field_declaration_list_item),
    ...preprocIf('_in_enumerator_list', $ => seq($.enumerator, ',')),
    ...preprocIf('_in_enumerator_list_no_comma', $ => $.enumerator, -1),

    preproc_arg: _ => token(prec(-1, /\S([^/\n]|\/[^*]|\\\r?\n)*/)),
    preproc_directive: _ => /#[ \t]*[a-zA-Z0-9]\w*/,

    _preproc_expression: $ => choice(
      $.identifier,
      alias($.preproc_call_expression, $.call_expression),
      $.number_literal,
      $.char_literal,
      $.preproc_defined,
      alias($.preproc_unary_expression, $.unary_expression),
      alias($.preproc_binary_expression, $.binary_expression),
      alias($.preproc_parenthesized_expression, $.parenthesized_expression),
    ),

    preproc_parenthesized_expression: $ => seq(
      '(',
      $._preproc_expression,
      ')',
    ),

    preproc_defined: $ => choice(
      prec(PREC.CALL, seq('defined', '(', $.identifier, ')')),
      seq('defined', $.identifier),
    ),

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $._preproc_expression),
    )),

    preproc_call_expression: $ => prec(PREC.CALL, seq(
      field('function', $.identifier),
      field('arguments', alias($.preproc_argument_list, $.argument_list)),
    )),

    preproc_argument_list: $ => seq(
      '(',
      commaSep($._preproc_expression),
      ')',
    ),

    preproc_binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $._preproc_expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $._preproc_expression),
        ));
      }));
    },

    // Declarations

    object_definition: $ => seq(
      optional(field('storage_class', $._storage_class)),
      field('type', $._class_definition),
      repeat(field('declarator', $.init_declarator)),
      ';',
    ),

    type_def: $ => seq(
      'typedef',
      field('type', $._class_definition),
      repeat1(field('declarator', $.init_declarator)),
      ';',
    ),

    _class_definition: $ => choice(
      seq(
        optional(field('class_modifier', $._class_modifier)),
        $._class_name,
      ),
      $._gtop_class,
      $._gins_class,
      $.struct_def,
      $.enum_def,
    ),

    _storage_class: $ => repeat1(choice(
      'static',
      'auto',
      'register',
      'const',
      'extern',
      'global',
      'universal',
      'private',
      'protected',
      'public',
      'virtual',
    )),

    _class_modifier: $ => repeat1(choice(
      'signed',
      'unsigned',
      'short',
      'long',
    )),

    init_declarator: $ => choice(
      $._declarator,
      seq($._declarator, '=', $.initializer,),
      seq($._declarator, '(', commaSep($.expression), ')',),
    ),

    _declarator: $ => choice(
      $.direct_declarator,
      $.pointer_declarator,
      $.array_declarator,
      $.function_declarator,
      $.parenthesized_declarator,
    ),

    pointer_declarator: $ => prec(PREC.UNARY, seq(
      choice('*', '&'),
      field('declarator', $._declarator),
    )),

    array_declarator: $ => prec(PREC.FIELD, seq(
      field('declarator', $._declarator),
      '[',
      optional(field('size', $.expression)),
      ']',
    )),

    function_declarator: $ => prec(PREC.FIELD, seq(
      field('declarator', $._declarator),
      '(',
      optional(field('parameters', $.parameter_list)),
      ')',
    )),

    parenthesized_declarator: $ => prec(PREC.PAREN_DECLARATOR, seq(
      '(',
      $._declarator,
      ')',
    )),

    direct_declarator: $ => choice(
      $.identifier,
      $.operator_declarator,
      $.conversion_declarator,
      seq(
        field('scope', 
          choice(
            $.identifier,
            $._class_name,
            $._gtop_class,
            $._gins_class,
          )
        ),
        '::',
        optional(seq(
          field('instance', $.instance_name),
          '::',
        )),
        field('name', choice(
          $.identifier,
          $.operator_declarator,
          $.conversion_declarator,
          $._class_name,
          seq('~', $._class_name),
        ))
      ),
    ),

    abstruct_declarator: $ => choice(
      $.abstruct_pointer_declarator,
      $.abstruct_array_declarator,
      $.abstruct_function_declarator,
      $.abstruct_parenthesized_declarator,
    ),

    abstruct_pointer_declarator: $ => prec(PREC.UNARY, seq(
      choice('*', '&'),
      optional(field('declarator', $.abstruct_declarator)),
    )),

    abstruct_array_declarator: $ => prec(PREC.FIELD, seq(
      optional(field('declarator', $.abstruct_declarator)),
      '[',
      optional(field('size', $.expression)),
      ']',
    )),

    abstruct_function_declarator: $ => prec(PREC.FIELD, seq(
      optional(field('declarator', $.abstruct_declarator)),
      '(',
      optional(field('parameters', $.parameter_list)),
      ')',
    )),

    abstruct_parenthesized_declarator: $ => prec(PREC.PAREN_DECLARATOR, seq(
      '(',
      $.abstruct_declarator,
      ')',
    )),

    instance_name: $ => choice(
      $.identifier,
      seq($.instance_name, '.', $.identifier),
    ),

    parameter_list: $ => choice(seq(
        commaSep1($.parameter_declaration),
        optional(','),
        optional('...'),
      ),
      '...',
    ),

    parameter_declaration: $ => choice(
      seq(
        optional(field('storage_class','const')),
        field('type', $._class_definition),
        optional(field('declarator',$.init_declarator))
      ),
      seq(
        optional('const'),
        field('type', $._class_definition),
        optional(field('declarator',$.abstruct_declarator))
      ),
    ),

    initializer: $ => choice(
      $.expression,
      seq('{', commaSep($.initializer), '}'),
    ),

    operator_declarator: $ => seq(
      'operator',
      field('operator', choice(
        '+',
        '-',
        '*',
        '/',
        '%',
        '<<',
        '>>',
        '&',
        '|',
        '^',
        '==',
        '!=',
        '>',
        '<',
        '>=',
        '<=',
        '!',
        '~',
        '++',
        '--',
        '=',
        '.*',
        '->*',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
        '<<=',
        '>>=',
        '&=',
        '|=',
        '^=',
        seq('[', ']'),
      )),
    ),

    conversion_declarator: $ => seq(
      'operator',
      field('type', choice(
        $._class_name,
      )),
    ),

    func_def: $ => seq(
      optional(field('storage_class', $._storage_class)),
      optional(field('type', $._class_definition)),
      field('declarator', $._declarator),
      field('body', $.compound_statement),
    ),

    compound_statement: $ => seq(
      '{',
      repeat($._block_item),
      '}',
    ),

    struct_def: $ => seq(
      choice('struct', 'class', 'union'),
      optional(field('name', $.identifier)),
      optional(seq(
        ':',
        choice('public', 'protected', 'private'),
        field('base', commaSep1($.classref)),
      )),
      field('body', $.member_definitions),
    ),

    member_definitions: $ => seq(
      '{',
      repeat($._field_declaration_list_item),
      '}',
    ),

    _field_declaration_list_item: $ => choice(
      $.object_definition,
      $.func_def,
      $.type_def,
      $.gins_def,
      $.member_label,
    ),

    member_label: $ => seq(
      field('label', choice('public', 'protected', 'private')),
      ':',
    ),

    gins_def: $ => seq(
      $._gins_class,
      optional(field('name', $.identifier)),
      seq(
        '{',
        repeat1(choice(
          field('attributes', $.func_def),
          field('instance', choice(
            $.object_definition,
            $.gins_def,
          )),
        )),
        '}',
      ),
      ';',
    ),

    enum_def: $ => seq(
      'enum',
      field('name', $.identifier),
      field('body', $.enumerator_list),
    ),

    enumerator_list: $ => seq(
      '{',
      commaSep($.enumerator),
      optional(','),
      '}',
    ),

    enumerator: $ => seq(
      field('name', $.identifier),
      optional(seq(
        '=',
        field('value', $.expression),
      )),
    ),

    // Statements

    statement: $ => choice(
      $.object_definition,
      $.type_def,
      $.case_statement,
      $.labeled_statement,
      $.expression_statement,
      $.compound_statement,
      $.try_statement,
      $.if_statement,
      $.while_statement,
      $.do_statement,
      $.for_statement,
      $.switch_statement,
      $.case_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.goto_statement,
      $.throw_statement,
      $.command_statement,
    ),

    expression_statement: $ => seq(
      optional(choice(
        $.expression,
        $.comma_expression,
      )),
      ';',
    ),

    try_statement: $ => seq(
      'try',
      field('body', $.compound_statement),
      repeat1($.catch_clause),
    ),

    catch_clause: $ => seq(
      'catch',
      field('parameters', $.parameter_list),
      field('body', $.compound_statement),
    ),

    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $.statement),
      optional(field('alternative', $.else_clause)),
    )),

    else_clause: $ => seq('else', $.statement),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $.statement),
    ),

    do_statement: $ => seq(
      'do',
      field('body', $.statement),
      'while',
      field('condition', $.parenthesized_expression),
      ';',
    ),

    for_statement: $ => seq(
      'for',
      '(',
      $._for_statement_body,
      ')',
      field('body', $.statement),
    ),
    _for_statement_body: $ => seq(
      field('initializer', optional(choice($.expression, $.comma_expression))),
      ';',
      field('condition', optional(choice($.expression, $.comma_expression))),
      ';',
      field('update', optional(choice($.expression, $.comma_expression))),
    ),

    switch_statement: $ => seq(
      'switch',
      field('condition', $.parenthesized_expression),
      field('body', $.compound_statement),
    ),

    case_statement: $ => prec.right(seq(
      choice(
        seq('case', field('value', $.expression)),
        'default',
      ),
      ':',
      repeat(choice(
        $.statement,
      )),
    )),

    labeled_statement: $ => seq(
      field('label', $._statement_identifier),
      ':',
      $.statement,
    ),

    return_statement: $ => seq(
      'return',
      optional(choice($.expression, $.comma_expression)),
      ';',
    ),

    break_statement: _ => seq(
      'break', ';',
    ),

    continue_statement: _ => seq(
      'continue', ';',
    ),

    goto_statement: $ => seq(
      'goto',
      field('label', $._statement_identifier),
      ';',
    ),

    throw_statement: $ => seq(
      'throw',
      optional($.expression),
      ';',
    ),

    command_statement: $ => seq(
      '@',
      field('command', repeat($.command)),
    ),

    command: $ => choice(
      $.identifier,
      $.string_literal,
      seq('`', $.expression, '`',),
    ),


    // Expressions

    
    expression: $ => choice(
      $.primary,
      $.call_expression,
      $.update_expression,
      $.cast_expression,
      $.binary_expression,
      $.unary_expression,
      $.pointer_expression,
      $.assignment_expression,
      $.obj_name,
      $.field_expression,
      $.subscript_expression,
      $.conditional_expression,
      $.parenthesized_expression,
      $.sizeof_expression,
      $.this,
      $.new_expression,
      $.delete_expression,
    ),

    comma_expression: $ => seq(
      field('left', $.expression),
      ',',
      field('right', choice($.expression, $.comma_expression)),
    ),

    _assignment_left_expression: $ => choice(
      $.identifier,
      $.call_expression,
      $.field_expression,
      $.pointer_expression,
      $.subscript_expression,
      $.parenthesized_expression,
    ),

    assignment_expression: $ => prec.right(PREC.ASSIGNMENT, seq(
      field('left', $._assignment_left_expression),
      field('operator', choice(
        '=',
        '*=',
        '/=',
        '%=',
        '+=',
        '-=',
        '<<=',
        '>>=',
        '&=',
        '^=',
        '|=',
      )),
      field('right', $.expression),
    )),

    pointer_expression: $ => prec.left(PREC.CAST, seq(
      field('operator', choice('*', '&')),
      field('argument', $.expression),
    )),

    unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $.expression),
    )),

    binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        ));
      }));
    },

    update_expression: $ => {
      const argument = field('argument', $.expression);
      const operator = field('operator', choice('--', '++'));
      return prec.right(PREC.UNARY, choice(
        seq(operator, argument),
        seq(argument, operator),
      ));
    },

    field_expression: $ => seq(
      prec(PREC.FIELD, seq(
        field('argument', $.expression),
        field('operator', choice('.', '->', '->*', '.*')),
      )),
      field('field', $._member_name),
    ),

    subscript_expression: $ => prec(PREC.SUBSCRIPT, seq(
      field('argument', $.expression),
      '[',
      field('index', $.expression),
      ']',
    )),
    
    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $.expression),
      '?',
      optional(field('consequence', choice($.expression, $.comma_expression))),
      ':',
      field('alternative', $.expression),
    )),

    parenthesized_expression: $ => seq(
      '(',
      choice($.expression, $.comma_expression, $.compound_statement),
      ')',
    ),

    call_expression: $ => prec(PREC.CALL, seq(
      field('function', $.expression),
      field('arguments', $.argument_list),
    )),

    argument_list: $ => seq('(', commaSep(choice($.expression, $.compound_statement)), ')'),

    classref: $ => choice(
      seq(
        optional(field('class_modifier', $._class_modifier)),
        $._class_name,
      ),
      $._gtop_class,
      $._gins_class,
      seq(
        choice('struct', 'class', 'union', 'enum'),
        choice(
          $._class_name,
          $._gtop_class,
          $._gins_class,
        ),
      )
    ),

    cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $.classref),
      optional(field('declarator', $.abstruct_declarator)),
      ')',
      field('argument', $.expression),
    )),

    sizeof_expression: $ => prec(PREC.SIZEOF, seq(
      'sizeof',
      field('argument', choice(
        seq('(', $.classref, optional($.abstruct_declarator), ')'),
        seq('(', $.expression, ')'),
      )),
    )),

    this: $ => 'this',

    new_expression: $ => prec.right(PREC.NEW, seq(
      optional($._storage_class),
      'new',
      field('type', $.classref),
      optional(field('size', seq(
        '[',
        optional($.expression),
        ']',
      ))),
      optional(field('initializer', seq(
        '(',
        optional(commaSep($.expression)),
        ')',
      ))),
    )),

    delete_expression: $ => prec.left(PREC.UNARY, seq(
      'delete',
      optional(field('array', seq('[', ']'))),
      field('argument', $.expression),
    )),


    obj_name: $ => choice(
      seq(
        optional('::'),
        choice(
          $.identifier,
          $.operator_declarator,
        )
      ),
      seq(
        field('scope', $._member_name),
        '::',
        field('name', choice(
          $.identifier,
          $.operator_declarator,
          $.obj_name,
        ))
      ),
    ),

    primary: $ => choice(
      $.integer_literal,
      $.integer64_literal,
      $.double_literal,
      $.unit_integer_literal,
      $.unit_double_literal,
      $.char_literal,
      $.concatenated_string,
      $.coordinate,
    ),

    coordinate_one: $ => seq(
      '/',
      choice(
        $.integer_literal,
        prec.left(PREC.UNARY, seq('-', $.integer_literal)),
        $.double_literal,
        prec.left(PREC.UNARY, seq('-', $.double_literal)),
      ),
    ),

    coordinate: $ => prec.left(repeat1($.coordinate_one)),

    // Literals

    identifier: _ => /[a-zA-Z_$][0-9a-zA-Z_$]*/,
    _class_name: $ => alias($.identifier, $.class_name),
    _gtop_class: $ => alias($.identifier, $.gtop_class),
    _gins_class: $ => alias($.identifier, $.gins_class),
    _member_name: $ => alias($.identifier, $.member_name),
    _statement_identifier: $ => alias($.identifier, $.statement_identifier),

    number_literal: $ => choice(
      alias($.integer_literal, $.number_literal),
      alias($.integer64_literal, $.number_literal),
      alias($.double_literal, $.number_literal),
      alias($.unit_integer_literal, $.number_literal),
      alias($.unit_double_literal, $.number_literal),
    ),

    integer_literal: _ => token(choice(
      /[0-9]+/,
      /0[xX][a-fA-F0-9]+/,
      /0[xX][a-fA-F0-9]+[LUlu]/,
    )),

    integer64_literal: _ => token(choice(
      /[0-9]+(LL|ll)/,
      /[0-9]+[hH]/,
      /0[xX][a-fA-F0-9]+(LL|ll)/,
      /0[xX][a-fA-F0-9]+[hH]/,
    )),

    double_literal: _ => token(choice(
      /[0-9]*\.[0-9]+([eE][\+|\-]?[0-9]+)?/,
      /[0-9]+\.[0-9]*([eE][\+|\-]?[0-9]+)?/,
      /[0-9]+([eE][\+|\-]?[0-9]+)/,
    )),

    unit_integer_literal: _ => token(
      /[0-9]+[a-zA-Z_$]+/,
    ),

    unit_double_literal: _ => token(choice(
      /[0-9]*\.[0-9]+([eE][\+|\-]?[0-9]+)?[a-zA-Z_$]+/,
      /[0-9]+\.[0-9]*([eE][\+|\-]?[0-9]+)?[a-zA-Z_$]+/,
      /[0-9]+([eE][\+|\-]?[0-9]+)[a-zA-Z_$]+/,
    )),

    char_literal: $ => seq(
      choice('L\'', '\''),
      repeat1(choice(
        $.escape_sequence,
        alias(token.immediate(/[^\n']/), $.character),
      )),
      '\'',
    ),

    concatenated_string: $ => prec.right(repeat1(
      $.string_literal,
    )),

    string_literal: $ => seq(
      choice('L"', '"'),
      repeat(choice(
        alias(token.immediate(prec(1, /[^\\"\n]+/)), $.string_content),
        $.escape_sequence,
      )),
      '"',
    ),

    escape_sequence: _ => token(prec(1, seq(
      '\\',
      choice(
        /[^xuU]/,
        /\d{2,3}/,
        /x[0-9a-fA-F]{1,4}/,
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/,
      ),
    ))),

    system_lib_string: _ => token(seq(
      '<',
      repeat(choice(/[^>\n]/, '\\>')),
      '>',
    )),

    // Comments
    comment: _ => token(choice(
      seq('//', /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
  },
});

/**
 * @param {string} suffix
 * @param {RuleBuilder<string>} content
 * @param {number} precedence
 * @returns {RuleBuilders<string, string>}
 */
function preprocIf(suffix, content, precedence = 0) {
  /**
   * @param {GrammarSymbols<string>} $
   * @returns {ChoiceRule}
   */
  function alternativeBlock($) {
    return choice(
      suffix ? alias($['preproc_else' + suffix], $.preproc_else) : $.preproc_else,
      suffix ? alias($['preproc_elif' + suffix], $.preproc_elif) : $.preproc_elif,
      suffix ? alias($['preproc_elifdef' + suffix], $.preproc_elifdef) : $.preproc_elifdef,
    );
  }

  return {
    ['preproc_if' + suffix]: $ => prec(precedence, seq(
      preprocessor('if'),
      field('condition', $._preproc_expression),
      '\n',
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),

    ['preproc_ifdef' + suffix]: $ => prec(precedence, seq(
      choice(preprocessor('ifdef'), preprocessor('ifndef')),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),

    ['preproc_else' + suffix]: $ => prec(precedence, seq(
      preprocessor('else'),
      repeat(content($)),
    )),

    ['preproc_elif' + suffix]: $ => prec(precedence, seq(
      preprocessor('elif'),
      field('condition', $._preproc_expression),
      '\n',
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
    )),

    ['preproc_elifdef' + suffix]: $ => prec(precedence, seq(
      choice(preprocessor('elifdef'), preprocessor('elifndef')),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
    )),
  };
}

/**
 * Creates a preprocessor regex rule
 * @param {RegExp | Rule | string} command
 * @returns {AliasRule}
 */
function preprocessor(command) {
  return alias(new RegExp('#[ \t]*' + command), '#' + command);
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 * @param {Rule} rule
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 * @param {Rule} rule
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
