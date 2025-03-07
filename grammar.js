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
  //STRUCTURED_BINDING: -1,
  CONDITIONAL: -1,
  DEFAULT: 0,
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  INCLUSIVE_OR: 3,
  EXCLUSIVE_OR: 4,
  BITWISE_AND: 5,
  EQUAL: 6,
  RELATIONAL: 7,
  //THREE_WAY: 8,
  //OFFSETOF: 8,
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
    [$._class_definition, $._qualified_identifier],
    [$._class_definition, $._direct_declarator],
    [$._class_definition],
    [$.qualified_declarator],
    [$.parameter_declaration],
    [$._classref, $._qualified_identifier],
    [$._classref],
    [$._direct_declarator, $.gins_definition],
    [$._class_definition, $.gins_definition],
    [$.enum_specifier],
    [$.enumerator_list],
  ],

  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  inline: $ => [
    $._class_name,
    $._gtop_class,
    $._gins_class,
    $._statement_identifier,
    $._assignment_left_expression,
    $._expression_not_binary,
    $._non_case_statement,
  ],

  supertypes: $ => [
    $.primary,
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
      $.function_definition,
      $.object_definition,
      $._empty_declaration,
      $.type_definition,
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
      $._empty_declaration,
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
    ...preprocIf('_in_gins_attributes_list_item', $ => $._gins_attributes_list_item),

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

    object_definition: $ =>  seq(
      optional(field('storage_class_specifier', $.storage_class_specifier)),
      field('type', $._class_definition),
      commaSep1(field('declarator', choice($._declarator, $.init_declarator))),
      ';',
    ),

    type_definition: $ => seq(
      'typedef',
      field('type', $._class_definition),
      commaSep(field('declarator', choice($._declarator, $.init_declarator))),
      ';',
    ),

    _class_definition: $ => choice(
      seq(
        optional(field('class_modifier', $.class_modifier)),
        $._class_name,
      ),
      $._gtop_class,
      $._gins_class,
      $.class_specifier,
      $.union_specifier,
      $.struct_specifier,
      $.enum_specifier,
    ),

    _empty_declaration: $ => seq(
      choice(
        $.class_specifier,
        $.union_specifier,
        $.struct_specifier,
        $.enum_specifier
      ),
      ';',
    ),

    storage_class_specifier: $ => repeat1(choice(
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

    class_modifier: $ => repeat1(choice(
      'signed',
      'unsigned',
    )),

    init_declarator: $ => choice(
      seq(
        field('declarator', $._declarator),
        '=',
        field('value', choice($.initializer_list, $.expression)),
      ),
      seq(field('declarator', $._declarator),
       '(', commaSep1($.expression), ')',),
    ),

    _declarator: $ => choice(
      $._direct_declarator,
      $.pointer_declarator,
      $.array_declarator,
      $.function_declarator,
      $.parenthesized_declarator,
    ),

    pointer_declarator: $ => prec.dynamic(1, prec.right(seq(
      choice('*', '&'),
      field('declarator', $._declarator),
    ))),

    array_declarator: $ => prec(1, seq(
      field('declarator', $._declarator),
      '[',
      optional(field('size', $.expression)),
      ']',
    )),

    function_declarator: $ => prec.right(1, seq(
      field('declarator', $._declarator),
      field('parameters', $.parameter_list),
    )),

    parenthesized_declarator: $ => prec(PREC.PAREN_DECLARATOR, seq(
      '(',
      field('declarator', $._declarator),
      ')',
    )),

    qualified_declarator: $ => seq(
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
      )),
    ),

    _direct_declarator: $ => choice(
      $.identifier,
      $.operator_declarator,
      $.conversion_declarator,
      $.qualified_declarator,
    ),

    abstruct_declarator: $ => choice(
      $.abstruct_pointer_declarator,
      $.abstruct_array_declarator,
      $.abstruct_function_declarator,
      $.abstruct_parenthesized_declarator,
    ),

    abstruct_pointer_declarator: $ => prec.dynamic(1, prec.right(seq(
      choice('*', '&'),
      optional(field('declarator', $.abstruct_declarator)),
    ))),

    abstruct_array_declarator: $ => prec(1, seq(
      optional(field('declarator', $.abstruct_declarator)),
      '[',
      optional(field('size', $.expression)),
      ']',
    )),

    abstruct_function_declarator: $ => prec(1, seq(
      optional(field('declarator', $.abstruct_declarator)),
      field('parameters', $.parameter_list),
    )),

    abstruct_parenthesized_declarator: $ => prec(1, seq(
      '(',
      $.abstruct_declarator,
      ')',
    )),

    instance_name: $ => choice(
      $.identifier,
      seq($.identifier, '.', $.instance_name),
    ),

    parameter_list: $ => seq(
      '(',
      optional(choice(
        seq(
          commaSep1($.parameter_declaration),
          optional(','),
          optional('...'),
        ),
        '...',
      )),
      ')',
    ),

    parameter_declaration: $ => choice(
      seq(
        optional(field('storage_class', 'const')),
        field('type', $._class_definition),
        optional(field('declarator', choice($._declarator, $.init_declarator)))
      ),
      seq(
        optional('const'),
        field('type', $._class_definition),
        optional(field('declarator', $.abstruct_declarator))
      ),
    ),

    initializer_list: $ => choice(
      seq('{', commaSep(choice($.initializer_list, $.expression)), '}'),
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

    function_definition: $ => seq(
      optional(field('storage_class_specifier', $.storage_class_specifier)),
      optional(field('type', $._class_definition)),
      field('declarator', $._declarator),
      field('body', $.compound_statement),
    ),

    compound_statement: $ => seq(
      '{',
      repeat($._block_item),
      '}',
    ),

    class_specifier: $ => seq(
      'class',
      $._class_declaration,
    ),

    union_specifier: $ => seq(
      'union',
      $._class_declaration,
    ),

    struct_specifier: $ => seq(
      'struct',
      $._class_declaration,
    ),

    _class_declaration: $ => prec.right(seq(
      choice(
        field('name', $._class_name),
        seq(
          optional(field('name', $._class_name)),
          optional($.base_class_clause),
          field('body', $.field_declaration_list),
        ),
      ),
    )),

    base_class_clause: $ => seq(
      ':',
      commaSep1(seq(
        optional(field('access_specifier', $.access_specifier)),
        $._classref,
      )
    )),

    access_specifier: _ => choice(
      'public',
      'private',
      'protected',
    ),

    field_declaration_list: $ => seq(
      '{',
      repeat($._field_declaration_list_item),
      '}',
    ),

    _field_declaration_list_item: $ => choice(
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
      alias($.preproc_if_in_field_declaration_list, $.preproc_if),
      alias($.preproc_ifdef_in_field_declaration_list, $.preproc_ifdef),
      alias($.object_definition, $.field_declaration),
      $.function_definition,
      $.type_definition,
      $.gins_definition,
      seq($.access_specifier, ':'),
    ),

    gins_definition: $ => seq(
      field('type', $._gins_class),
      optional(field('name', $.identifier)),
      seq(
        '{',
        repeat($._gins_attributes_list_item),
        '}',
      ),
      ';',
    ),

    _gins_attributes_list_item: $ => choice(
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
      alias($.preproc_if_in_gins_attributes_list_item, $.preproc_if),
      alias($.preproc_ifdef_in_gins_attributes_list_item, $.preproc_ifdef),
      alias($.object_definition, $.gins_definition),
      alias($.function_definition, $.gins_attributes_definition),
      $.gins_definition,
    ),

    enum_specifier: $ => seq(
      'enum',
      choice(
        seq(
          field('name', $._class_name),
          optional(field('body', $.enumerator_list)),
        ),
        field('body', $.enumerator_list),
      ),
    ),

    enumerator_list: $ => seq(
      '{',
      repeat(choice(
        seq($.enumerator, ','),
        alias($.preproc_if_in_enumerator_list, $.preproc_if),
        alias($.preproc_ifdef_in_enumerator_list, $.preproc_ifdef),
        seq($.preproc_call, ','),
      )),
      optional(seq(
        choice(
          $.enumerator,
          alias($.preproc_if_in_enumerator_list_no_comma, $.preproc_if),
          alias($.preproc_ifdef_in_enumerator_list_no_comma, $.preproc_ifdef),
          $.preproc_call,
        ),
      )),
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
      $.case_statement,
      $._non_case_statement,
    ),

    _non_case_statement: $ => choice(
      $.object_definition,
      $.type_definition,
      $.labeled_statement,
      $.expression_statement,
      $.compound_statement,
      $.try_statement,
      $.if_statement,
      $.while_statement,
      $.do_statement,
      $.for_statement,
      $.switch_statement,
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
        $._non_case_statement,
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
      repeat($._command),
      ';',
    ),

    _command: $ => choice(
      $.command_identifier,
      alias($.string_literal, $.command_string),
      $.integer_literal,
      $.double_literal,
      $.command_expression,
    ),

    command_expression : $ => seq('\`', $.expression, '\`'),


    // Expressions

    
    expression: $ => choice(
      $._expression_not_binary,
      $.binary_expression,
    ),

    _expression_not_binary: $ => choice(
      $.primary,
      $.true,
      $.false,
      $.null,
      $.call_expression,
      $.update_expression,
      $.cast_expression,
      $.unary_expression,
      $.pointer_expression,
      $.assignment_expression,
      $._qualified_identifier,
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
      field('field', $._member_identifier),
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

    _classref: $ => choice(
      seq(
        optional(field('class_modifier', $.class_modifier)),
        $._class_name,
      ),
      $._gtop_class,
      $._gins_class,
      $.class_specifier,
      $.struct_specifier,
      $.union_specifier,
      $.enum_specifier,

    ),

    type_descriptor: $ => seq(
      field('type', $._classref),
      optional(field('declarator', $.abstruct_declarator)),
    ),

    cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $.type_descriptor),
      ')',
      field('argument', $.expression),
    )),

    sizeof_expression: $ => prec(PREC.SIZEOF, seq(
      'sizeof',
      choice(
        seq('(', field('type', $.type_descriptor), ')'),
        field('argument', $.expression),
      ),
    )),

    this: $ => 'this',

    new_expression: $ => prec.right(PREC.NEW, seq(
      optional(field('storage_class_specifier', $.storage_class_specifier)),
      'new',
      field('type', $._classref),
      optional(field('declarator', $.new_declarator)),
      optional(field('arguments', seq(
        '(',
        commaSep($.expression),
        ')',
      ))),
    )),

    new_declarator: $ => prec.right(seq(
      '[',
      field('size', $.expression),
      ']',
      optional($.new_declarator),
    )),

    delete_expression: $ => prec.left(PREC.UNARY, seq(
      'delete',
      optional(field('array', seq('[', ']'))),
      field('argument', $.expression),
    )),

    _qualified_identifier: $ => choice(
      $.identifier,
      $.qualified_identifier,
    ),

    qualified_identifier: $ => choice(
      seq(
        '::',
        field('name', choice(
          $.identifier,
          $.operator_declarator,
        )),
      ),
      seq(
        field('scope', $._namespace_identifier),
        '::',
        field('name', choice(
          $.identifier,
          $.operator_declarator,
          $.qualified_identifier,
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
      $._string,
      $._coordinate,
    ),

    _string: $ => prec.left(choice(
      $.string_literal,
      $.concatenated_string,
    )),

    _coordinate: $ => prec.right(choice(
      $.coordinate_point,
      $.coordinate,
    )),

    coordinate_point: $ => seq(
      '/',
      field('x', seq(optional('-'), choice($.integer_literal, $.double_literal))),
      field('y', seq(optional('-'), choice($.integer_literal, $.double_literal))),
    ),
    
    coordinate: $ => prec.right(seq(
      seq($.coordinate_point, $.coordinate_point),
      repeat($.coordinate_point),
    )),

    // Literals

    true: _ => token(choice('TRUE', 'true')),
    false: _ => token(choice('FALSE', 'false')),
    null: _ => choice('NULL', 'nullptr'),

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

    concatenated_string: $ => prec.right(seq(
      seq($.string_literal, $.string_literal),
      repeat($.string_literal),
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

    identifier: _ => /[a-zA-Z_\$][0-9a-zA-Z_\$]*/,
    _class_name: $ => alias($.identifier, $.class_name),
    _gtop_class: $ => alias($.identifier, $.gtop_class),
    _gins_class: $ => alias($.identifier, $.gins_class),
    _member_identifier: $ => alias($.identifier, $.member_identifier),
    _namespace_identifier: $ => alias($.identifier, $.namespace_identifier),
    _statement_identifier: $ => alias($.identifier, $.statement_identifier),

    command_identifier: _ => /[a-zA-Z_\$\.\-][0-9a-zA-Z_\$\.\-]*/,

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
