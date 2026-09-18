# Callable declarators

AXEL callable operators use `operator_declarator`. This includes `operator[]` and `operator()`. The callable operator token is available through the `operator` field; consumers may use the full declarator text when the operator consists of more than one token.

Destructor names use the named `destructor_name` node in declarations and explicit call expressions. Its `name` field contains the class name. The node is used in these positions:

- the `declarator` field of an inline destructor's `function_declarator`;
- the `name` field of a `qualified_declarator` such as `Type::~Type`;
- the `field` of object and pointer calls such as `value.~Type()` and `pointer->~Type()`; and
- the `name` field of a `qualified_identifier` such as `Type::~Type()`.

Consumers should use `destructor_name` instead of reconstructing a destructor from `ERROR` nodes. Incomplete destructor text remains ordinary Tree-sitter error recovery and must not be treated as a resolved callable.

After changing callable syntax, regenerate `src/grammar.json`, `src/node-types.json`, and `src/parser.c`, then run the corpus and binding tests. Downstream integration requires rebuilding the native Node binding and linking that build into the Language Server.
