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
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
