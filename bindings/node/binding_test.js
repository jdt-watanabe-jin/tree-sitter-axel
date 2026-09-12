const assert = require("node:assert");
const { test } = require("node:test");

const Parser = require("tree-sitter");

test("can load grammar", () => {
  const parser = new Parser();
  assert.doesNotThrow(() => parser.setLanguage(require(".")));
});

test("retains literal assignment operands for semantic diagnostics", () => {
  const parser = new Parser();
  parser.setLanguage(require("."));
  const root = parser.parse("void f(){ 1=2; }").rootNode;
  assert.strictEqual(root.hasError, false);
  const assignment = root.descendantsOfType("assignment_expression")[0];
  assert.strictEqual(assignment.childForFieldName("left").type, "integer_literal");
  assert.strictEqual(assignment.childForFieldName("operator").text, "=");
});

test("retains unnamed parameter types in prototypes and function pointers", () => {
  const parser = new Parser();
  parser.setLanguage(require("."));
  const root = parser.parse("void f(int); int (*callback)(int);").rootNode;
  assert.strictEqual(root.hasError, false);
  const functions = root.descendantsOfType("function_declarator");
  assert.strictEqual(functions.length, 2);
  for (const fn of functions) {
    const parameter = fn.childForFieldName("parameters").namedChildren[0];
    assert.strictEqual(parameter.childForFieldName("type").text, "int");
  }
});

test("parses static type definitions without inventing object names", () => {
  const parser = new Parser();
  parser.setLanguage(require("."));
  const root = parser.parse([
    "static struct StrParaRec { int value; };",
    "static class StrParaList { int count; };",
    "static struct Item { int value; } item;",
    "static int count;",
  ].join("\n")).rootNode;
  assert.strictEqual(root.hasError, false);
  const types = root.namedChildren.filter(node => ["struct_specifier", "class_specifier"].includes(node.type));
  assert.deepStrictEqual(types.map(node => node.childForFieldName("name").text), ["StrParaRec", "StrParaList"]);
  assert.deepStrictEqual(types.map(node => node.childForFieldName("body").namedChildren[0].childForFieldName("declarator").text), ["value", "count"]);
  const objects = root.namedChildren.filter(node => node.type === "object_definition");
  assert.deepStrictEqual(objects.map(node => node.childForFieldName("declarator").text), ["item", "count"]);
  assert.ok(objects.every(node => node.childForFieldName("storage_class_specifier").text === "static"));
});
