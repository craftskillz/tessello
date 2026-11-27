---
name: retrodoc-architecture
description: Analyze source dependencies around documented features, draw diagrams, and identify evidenced cycles or possible god objects. Use to assess separation and refactoring impact in an existing project.
---

This skill is independently installable. Supporting workflows and tools are bundled locally; follow their links only when needed. Companion skills do not need to be installed. Use bundled procedures directly when this workflow calls for them.

# Analyze feature architecture

Read [the documentation contract](references/documentation-contract.md) and [graph rules](references/graph.md). The feature-to-file mapping lives in the technical feature pages. If they are absent, derive a minimal mapping for the requested scope from `surfaces.md` and the source, and mark it provisional.


When invoked for a Retrodoc ticket, inherit its selected scope and validated roots, follow [the ticket execution and handoff rules](references/ticket-workflow.md), use a fresh conversation for that ticket, and stop after its handoff. Additional tickets require additional fresh contexts. A ticket is not evidence: re-read its executable source leads before accepting claims.

Before discovery, follow the contract's source/output root procedure: capture the invocation directory as `DOCS_ROOT`, recover valid saved roots or use supplied roots, and ask for the source path only when neither is available. In a parent Retrodoc workflow, inherit its validated roots without asking again. All documentation is written directly under `DOCS_ROOT`; source inspection uses `SOURCE_ROOT`.

## Gather evidence

Apply the contract's English-language and evidence policy. Revalidate existing feature mappings against code and executable tests. Documentation, ADRs, comments and descriptive docstrings cannot establish an edge, responsibility or rationale.

Inspect imports, calls, framework registrations, dependency injection, event wiring and data access. Prefer installed language-aware analysis tools; record command/version, roots and resolution limits. Otherwise inspect source and build the same evidence format manually. Text search provides candidates, not resolved edges. No universal parser is assumed.

Choose one granularity per dataset: file, symbol or module. Resolve aliases, re-exports and generated wiring where possible. Keep unresolved destinations in coverage limitations instead of inventing local links. Record feature participation on nodes and dependency evidence on edges using the graph format.

## Compute and interpret

Write `architecture/dependencies.json`. Run the bundled [analyzer](scripts/analyze_graph.py) with actual graph and project paths. Resolve `<installed-skill>` to the directory containing the installed top-level `SKILL.md`, even when reading this procedure from `references/workflows/`:

```sh
python3 "<installed-skill>/scripts/analyze_graph.py" "<DOCS_ROOT>/architecture/dependencies.json" --root "<SOURCE_ROOT>" --kind import > "<DOCS_ROOT>/architecture/dependencies.md"
```

Run separately for other relevant relation kinds. Keep outputs separately named when retaining multiple views. The script validates evidence locations and produces a typed Mermaid graph, cyclic strongly connected components, and degree/feature participation counts. It does not parse source, prove evidence semantics or diagnose god objects.

Inspect each reported cyclic component and describe a concrete closed path with cited edges. Explain whether it is an import, type, call, event or other cycle, its observed consequences, and what remains hypothetical. Call cycles can be intentional recursion; import cycles are not automatically runtime failures.

For possible god objects/modules, read high-participation or high-degree candidates. Seek unrelated responsibilities, control over others' state, and independently changing behavior concentrated in one symbol/module. Explain alternative interpretations such as composition roots, facades, registries or shared value types. File size and centrality alone are insufficient. Claim change coupling only when inspected executable-code diffs support it; commit messages and historical prose are not evidence of behavior or rationale.

## Deliver

Write `architecture/findings.md` with scope, snapshot, limits, linked diagrams, and findings containing evidence, confidence, impact, counterevidence, proposed separation and behavior-preserving verification. Label proposals distinctly from current architecture. Include “no evidenced findings in the inspected scope” when appropriate.

Keep feature-to-file participation separate from directed dependency views. Feature-level aggregation may introduce apparent cycles absent at file level; label projections and inspect underlying paths. Link findings from affected technical feature pages and the atlas index. Suggest changes without executing a refactor.

## Publish the local reading edition

Follow [the HTML publication contract](references/html-format.md): write canonical Markdown, then produce sibling HTML pages only by running its bundled renderer, never a hand-written converter. Refresh the HTML atlas navigation for pages actually produced. Preserve all evidence and unknowns; label future-state diagrams as proposals. Validate the reading edition and return both entry points. Discovery-only scope remains an inventory and coverage, without feature placeholders.
