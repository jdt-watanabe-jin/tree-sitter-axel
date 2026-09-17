# Syntax recovery

## Unterminated block comments

A block comment that starts with `/*` and has no closing `*/` is represented by the named extra node `unterminated_comment`.

The node:

- spans from the `/*` opener through end of file;
- consumes all apparent AXEL code, braces, directives, and comment markers after the opener;
- has no child or field representing a closing delimiter; and
- does not change the syntax-tree shape of a closed block comment, which remains a `comment` node.

This recovery prevents text inside an unclosed comment from being emitted as fake functions, blocks, regions, or other syntax nodes. Consumers must ignore `unterminated_comment` when collecting folding ranges or documentation comments.

The recovery node is accepted grammar syntax and may leave `root.hasError` as `false`. A consumer that reports syntax diagnostics must therefore recognize `unterminated_comment` explicitly and report `Missing */`; checking only Tree-sitter error or `MISSING` nodes is insufficient.

When changing this rule, preserve these compatibility properties:

1. Closed line and block comments keep their existing `comment` node shape.
2. An unterminated block comment is one token through end of file and never exposes nested fake syntax.
3. The recovery node never implies that a closing delimiter exists.

After grammar changes, regenerate the parser and run both corpus and Node binding tests. Downstream local integration requires the regenerated parser build to be linked into the Language Server; a Language Server that still resolves the published `tree-sitter-axel#v0.1.0` tag does not receive this recovery node.
