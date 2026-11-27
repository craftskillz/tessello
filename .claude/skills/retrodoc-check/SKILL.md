---
name: retrodoc-check
description: Check or refresh source-derived feature documentation for stale claims, broken references, missing coverage and inconsistent dependency diagrams.
---

This skill is independently installable. Supporting workflows and tools are bundled locally; follow their links only when needed. Companion skills do not need to be installed. Use bundled procedures directly when this workflow calls for them.

# Check or refresh documentation

Read [the documentation contract](references/documentation-contract.md), including its English-language and evidence policy. Default to a check report; update pages when requested or when called as the final phase of a documentation run.


When invoked for a Retrodoc ticket, inherit its selected scope and validated roots, follow [the ticket execution and handoff rules](references/ticket-workflow.md), use a fresh conversation for that ticket, and stop after its handoff. Additional tickets require additional fresh contexts. A ticket is not evidence: re-read its executable source leads before accepting claims.

Before discovery, follow the contract's source/output root procedure: capture the invocation directory as `DOCS_ROOT`, recover valid saved roots or use supplied roots, and ask for the source path only when neither is available. In a parent Retrodoc workflow, inherit its validated roots without asking again. All documentation is written directly under `DOCS_ROOT`; source inspection uses `SOURCE_ROOT`.

1. Read index, page snapshots and coverage. Compare current source against those snapshots. Include local/untracked changes; without a recoverable baseline, state that freshness needs direct reinspection. Inspect routes, menus, endpoints and commands for new or deleted surfaces against `surfaces.md`, not only files already indexed.
2. Check local documentation/source links, symbols, feature IDs, source-table roles and agreement with the reverse index. Check each feature has a functional page, plus a technical page once its status is beyond `functional`, and that functional pages keep implementation terms out of their prose. Report missing files, moved symbols, orphan pages and unassigned surfaces. Resolve Markdown links relative to their document and graph evidence paths relative to `SOURCE_ROOT`. Validate `retrodoc-context.json` against the established roots and check cross-directory source links, including after relocation.
3. Review accuracy separately from structure: trace material behavioral claims and copy prerequisites to executable artifacts, test assertions or `User-stated` answers in `questions.md`. Where source contradicts a user statement, check that the page documents the source behavior and keeps the discrepancy. Check that every `Q-NNN` cited by a page exists in `questions.md`, and report questions still open. Reject ADRs, other documentation, comments and descriptive docstrings as factual support. Check that generated prose is English while source identifiers remain exact. Treat executable tests as strong contract evidence and record assertion scope, mocking, skips and execution status. Check dependency closure, inbound consumers and contracts. When sampling, name checked claims/features and leave unsampled pages unverified; a link check cannot verify semantics.
4. Validate dependency data and regenerate relevant typed graph views with the bundled [architecture analyzer](scripts/analyze_graph.py). Review edge evidence and relation types manually. Check findings distinguish cycles, shared participation and heuristic god-object candidates. Recompute affected views after edge/node changes.
5. Write `checks.md` with scope/snapshot, structural results, behavioral accuracy results, commands/results, unresolved discrepancies and page statuses. Preserve historical execution results with dates; don't turn “tests found” into “tests passed”.

For refreshes, follow [retrodoc-feature](references/workflows/retrodoc-feature.md) for affected pages, update mappings/snapshots, then reconcile architecture and indexes. Preserve unrelated authored content; within scope, correct or mark unsupported claims and retain unresolved implementation/test contradictions explicitly. Retire removed features explicitly and redirect renamed IDs. Leave untouched pages' verification dates unchanged.

Done when every finding has evidence, impact and disposition (fixed, unresolved, or outside scope), and the report states checks actually performed. A documentation check does not authorize application fixes or feature extraction.

## Check both reading formats

Follow [the HTML publication contract](references/html-format.md). Run its bundled renderer with `--check` for source-hash drift, links, fragments, IDs and incomplete diagrams instead of checking them by hand, and re-render with it after corrections. Check paired pages for source-hash drift, content/evidence parity, local links and fragments, navigation, diagram fidelity and accessibility. Record visual checks actually performed separately from structural checks. In check-only mode produce `checks.md` and render only that page to `checks.html` by passing it to the renderer; report other stale or missing HTML without changing it. In refresh/finalization mode regenerate affected HTML after Markdown corrections and preserve untouched inspection snapshots.
