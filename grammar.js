/**
 * @file Axel grammar for tree-sitter
 * @author JinWatanabe
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "axel",

  rules: {
    source_file: $ => repeat($.expression),

    expression: $ => choice(
      $.identifier,
      $.number,
      seq($.identifier, '=', $.expression)
    ),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    number: $ => /\d+/
  }
});
