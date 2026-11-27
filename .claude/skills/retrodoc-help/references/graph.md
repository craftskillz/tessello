# Dependency evidence format (version 1)

The analyzer consumes evidence collected by an agent or a language-aware tool. It does not discover dependencies itself. Use UTF-8 JSON with this shape:

```json
{
  "version": 1,
  "snapshot": "actual revision and dirty state, or dated snapshot",
  "granularity": "file",
  "scope": "production source under src/; tests excluded",
  "limitations": ["Dynamic plugin loading unresolved"],
  "features": ["checkout"],
  "nodes": [
    {"id": "checkout", "label": "src/checkout.py", "path": "src/checkout.py", "features": ["checkout"]},
    {"id": "money", "label": "src/money.py", "path": "src/money.py", "features": ["checkout"]}
  ],
  "edges": [
    {"from": "checkout", "to": "money", "kind": "import", "evidence": [
      {"path": "src/checkout.py", "line": 3, "note": "Imports Money from the resolved local module"}
    ]}
  ]
}
```

Use real paths/lines, not the illustrative entries above. All node and evidence paths resolve against `SOURCE_ROOT`, passed as `--root`; the graph and generated reports live under `DOCS_ROOT/architecture/`, which may be outside the source tree. A graph file location never determines the source root. `features` declares stable IDs; node participation references them. All nodes are local files, symbols or modules at the declared granularity. For a symbol node, label it with its qualified symbol and set `path` to its containing file. For a module, use its inspected directory or entry file. Keep external dependencies and unresolved targets in feature contracts/limitations, outside this local graph.

Each edge is directed **consumer → dependency**. Supported kinds:

- `import`: runtime import/use of a local module.
- `type`: type-only dependency, kept separate from runtime imports.
- `call`: statically resolved caller → callee; not a runtime execution trace.
- `event`: producer → consumer, supported by publisher/subscription wiring; this is message flow, not an import dependency.
- `data`: reader/writer → local schema/data-owner implementation; sharing a table does not create a direct call edge.
- `config`: implementation → local registration/configuration on which it depends.

An evidence entry must point to an active executable construct or machine-consumed configuration, never to documentation, an ADR, explanatory comments or descriptive docstrings. Executable tests can establish test dependencies; distinguish their scope from production edges. Write collector notes in English. The analyzer checks locations, not whether a cited line is executable; the collecting/checking agent must verify eligibility and semantics. Each entry includes a `SOURCE_ROOT`-relative file path, positive line number and explanatory note; multiple entries can establish wiring. Conditional edges state their conditions in the note. A possible cycle whose edges are mutually exclusive is not a demonstrated runtime cycle. Represent unresolved dynamic calls as limitations, not confirmed edges.

Run each kind independently. The analyzer reports cyclic strongly connected components (including self-loops), not every possible cycle. Supply a closed path and its evidence in the human findings. Absence of cycles means none in this supplied graph and relation, not a proof about the whole system.

Degree is the count of distinct incoming/outgoing neighbors for the selected relation. Feature participation is a separate count. These measurements identify inspection candidates, never god-object verdicts. For large graphs, create focused datasets with explicit scope and boundary omissions to keep diagrams readable; retain the full evidence dataset separately.

The analyzer checks schema essentials, unique IDs/edges, declared features, endpoints, path containment/existence and evidence line bounds. The agent must verify that the cited source actually establishes the claimed relation. Markdown/Mermaid labels are escaped; generated diagrams use internal node IDs and a table maps them to paths.
