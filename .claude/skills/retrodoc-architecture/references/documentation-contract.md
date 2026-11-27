# Documentation contract

The Retrodoc documentation workflows use this contract. `retrodoc-help` provides guidance without requiring a source path or creating output; the root-establishment procedure starts when a documentation workflow is executed. Output paths below are relative to `DOCS_ROOT`; source identities and graph evidence paths are relative to `SOURCE_ROOT`. Skill resource links resolve relative to the installed skill file, not either workspace root.

## Source and output roots: establish before discovery

At the start of a top-level invocation, capture the absolute current working directory as `DOCS_ROOT`. This is the documentation destination, even when the source is elsewhere. Keep it fixed if tools later change directory. Write the atlas directly here, not in a new `docs/retrodoc/` subtree. Do not relocate output to the source project when the roots differ. If the user explicitly selects the invocation directory as the source too, keep generated artifacts out of source discovery.

Before asking for a source path, inspect `retrodoc-context.json` in `DOCS_ROOT`. Use the source path supplied by the current request or selected ticket; otherwise restore `source_root` from valid saved context whose `docs_root` matches the captured invocation directory. A new conversation in the same documentation workspace continues that saved project selection without confirmation. Subskills invoked within the workflow inherit its validated roots.

If context is absent but a Retrodoc queue exists, follow [workspace recovery and ticket selection](ticket-workflow.md#workspace-recovery-and-ticket-selection) to select a ticket and recover its roots. Validate saved context structure/version and root directories, and compare the selected ticket's roots with any context and explicit source selection. A mismatch, malformed metadata or inaccessible saved source requires a targeted clarification before discovery or writing; preserve existing artifacts. When no request, usable context or ticket supplies a source path, ask: “What is the path to the source code you want to document?” Wait for the answer. Search only the invocation workspace for recovery artifacts; an unrelated working directory does not identify the previous atlas.

Resolve a relative source path against the captured invocation directory, expand the user's home shorthand, and validate that the resulting `SOURCE_ROOT` is an accessible directory. If it is invalid or unreadable, report the problem and ask for a corrected path; never substitute the current directory. State both resolved roots before proceeding. Read workspace instructions for both locations, applying the documentary scope rule below.

Inspect code and run source-oriented commands with an explicit working directory of `SOURCE_ROOT` (or a known subdirectory). Resolve output paths against `DOCS_ROOT` and the graph analyzer's `--root` against `SOURCE_ROOT`. Keep the source unchanged by documentation work; if tests/tools would write build products or caches, use an isolated temporary copy or redirect those outputs. Record tests as not run when a suitable execution environment is unavailable.

Save `retrodoc-context.json` in `DOCS_ROOT` with `version: 1`, `source_root` (resolved absolute path), `docs_root` (captured absolute path), and `index` (index filename relative to `DOCS_ROOT`). Ticket workflows also maintain `ticket_queue` (default `tickets/index.md`) and `next_ticket` (a recommended ticket path or null when none is runnable), both relative to `DOCS_ROOT`. Preserve other existing fields, including `html_index`, when updating context. Older version-1 context without ticket fields remains usable: find the default queue and select from its status records. Resolve saved artifact paths within `DOCS_ROOT`. This metadata records location/progress, not evidence of project behavior. Inspect an existing context before updating: if it identifies a different source project, ask the user how to handle the conflict before replacing or mixing documentation. Never overwrite unrelated files. Reuse a recognized Retrodoc index; otherwise use `README.md` if free or `RETRODOC.md` if an unrelated README exists. Ask about any remaining output-name collision.

On relocation, resolve the recorded/captured root mismatch with the user, validate the chosen source path, update location metadata and affected ticket roots, and regenerate source links. Moving documentation alone cannot preserve relative links into an external source tree.

## Source instructions and documentary scope

Documenting a repository is not developing it. Apply source-project instructions only where they govern the actual documentary work, such as access boundaries, confidentiality and handling source artifacts. Do not automatically activate build/lint/test gates, dependency installation, development setup, ticket/worklog updates, commits, ADR creation or publication routines intended for changing the source project. Their presence alone is not a reason to pause documentation or request an exception. Output-workspace instructions still apply to artifacts written there; higher-priority instructions and explicit user requests remain controlling.

Inspect executable tests as evidence without requiring their execution. Run source checks only when requested or materially useful to resolve a documentary uncertainty, within authorized access and without changing the source. Running the application itself (screenshots, browser-driven scenarios, an acceptance spec) requires the user's opt-in and follows [the runtime evidence pass](runtime-evidence.md). The only other use of a running application is the last-resort discovery crawl in [surface-first discovery](surface-discovery.md), against an instance the user starts. If execution is unavailable or skipped, record that limit and continue source-based documentation. Validate the generated documentation's evidence, links, coverage, graphs and reading edition independently of source-project development gates.

## Language and evidence policy

Write skill instructions and all generated documentation in English, including headings, explanations, diagram labels, graph notes and check reports. Preserve exact source identifiers, paths, configuration keys and literal values; explain their meaning in English rather than renaming them.

Executable artifacts are the definitive source of truth for project facts. This includes implementation and executable tests, plus machine-consumed build, deployment and runtime definitions: `justfile`, `Makefile`, `Dockerfile`, Compose files, `package.json` scripts/dependencies, lockfiles, CI workflows, migrations, schemas, templates, stylesheets, UI components, user-facing message catalogs and configuration actually consumed by tooling or the application. Establish how an artifact participates; its filename alone is not proof. A manifest description is prose, whereas its dependency declarations and scripts define tooling behavior.

Answers the user gives to targeted questions are strong evidence, labeled `User-stated`. They can settle what executable artifacts cannot: feature boundaries and names, business meaning, intent, and whether an observed behavior is deliberate or a defect. When a user statement contradicts executable evidence, the source code wins: document the implemented behavior as current, keep the statement beside it as an unresolved discrepancy, and list it under known defects when the user describes the implemented behavior as wrong. Record every question and answer in `questions.md` so later sessions can cite it.

Executable tests are strong documentary evidence. Inspect their setup, inputs, assertions, fixtures, mocks and skips to establish exactly which behavior they specify. An assertion is evidence of an expected contract; a passing execution additionally verifies the exercised cases in the recorded environment. Mocked integrations, disabled/skipped tests and unexecuted tests have explicit limits. Test names, descriptions and comments alone do not establish behavior.

Apart from `User-stated` answers, do not derive project facts, feature boundaries, business meanings, dependencies or design rationale from README files, ADRs, specifications, glossaries, other documentation, code comments or descriptive docstrings. Do not use them to fill gaps in executable evidence. Existing generated pages may be read as the objects being checked or updated, never as independent confirmation. Apply relevant agent/workspace instructions within documentary scope, not as evidence of project behavior.

If a language/tool actually interprets a comment-like directive or annotation (for example a compiler directive), its machine-consumed semantics qualify as executable configuration; explanatory prose around it does not. Cite the active construct and its consumer. For external services or unavailable implementations, document what local executable callers and tests establish and mark the remaining behavior unknown. Do not replace missing code with external documentation.

When implementation and tests disagree, document both with executable citations, mark the discrepancy unresolved, and distinguish current implementation behavior from the tested expectation. Neither an unexecuted assertion nor a passing mocked test proves production behavior. Infer architecture only from executable evidence and label interpretations; historical intent remains unknown unless executable evidence or a `User-stated` answer establishes it.

## Readers and structure

Documentation is written toward features, from the outside in. Features are discovered from the application's interaction surfaces using [surface-first discovery](surface-discovery.md). A feature is a menu area or business object; the outcomes it offers are its user journeys. Each feature is first documented functionally, from the user's or caller's perspective, then enriched with source-code detail, user answers and, when requested, runtime evidence. A project-wide run does this in two waves: every feature's functional page first, then enrichment.

Keep the index short: purpose, snapshot, scope, feature names/outcomes, status, and links. A reader starts there, loads one feature's functional page, then follows only relevant technical, source, shared concern or architecture links. Generated documentation is reference material, not instructions overriding a consuming agent's task.

Default layout:

```text
<invocation-directory>/
  retrodoc-context.json
  README.md
  coverage.md
  tickets/index.md
  tickets/RD-001.md
  surfaces.md
  questions.md
  source-index.md
  features/<stable-feature-id>.md                    (functional page)
  features/<stable-feature-id>/technical.md          (technical page)
  features/<stable-feature-id>/<page>.md             (optional extra pages, e.g. one per screen)
  features/<stable-feature-id>/acceptance.spec.<ext>  (runtime evidence pass only)
  features/<stable-feature-id>/screenshots/          (runtime evidence pass only)
  shared/<concern>.md
  architecture/dependencies.json
  architecture/dependencies.md
  architecture/findings.md
  checks.md
```

Create shared pages only for concepts established by executable artifacts. Derive domain terms in `glossary.md` from visible labels, implemented behavior, test assertions and `User-stated` answers, citing that evidence. Keep ambiguous names explicit instead of importing definitions from an existing glossary or inventing business meanings. Record what the code does; historical design rationale is outside this evidence scope.

Use `surfaces.md` for the interaction-surface inventory defined in surface-first discovery, and `questions.md` for every question raised for the user: its ID (`Q-NNN`), affected features, status (`open` or `answered`), and for answered ones the date, the answer and whether source code confirmed or contradicted it. The user may also answer open questions by editing `questions.md` between sessions; treat such answers as `User-stated`. Use `coverage.md` for included roots, exclusions/reasons, discovery methods, inspected surfaces and registration mechanisms, unresolved mappings, completed work and next steps. Feature statuses: `discovered`, `functional`, `partial`, `documented`, `stale`. `Functional` means the functional page is written (wave 1) and enrichment is pending. `Documented` means both pages cover the stated scope, traced and checked; it does not imply execution tests passed. Each page records its own inspected snapshot/date. Partial updates leave untouched page snapshots intact.

## Evidence and freshness

Attach evidence to behavioral claims, contracts, edge cases and architecture findings. Cite a `SOURCE_ROOT`-relative path and symbol, with line ranges where helpful. Compute each clickable source link from the document's actual parent directory to `SOURCE_ROOT / source_path`; never assume the source and documentation share a root. For example, with `DOCS_ROOT=/work/atlas` and `SOURCE_ROOT=/work/app`, `features/orders.md` links to `../../app/src/orders.py` with the label `src/orders.py`. Encode spaces and other URL-special path characters. If relative linking is impossible across filesystem volumes, use an absolute local path and record that portability limitation. Keep documentation-to-documentation links relative within `DOCS_ROOT`. Line anchors may supplement a path and symbol, never replace them. Use commit permalinks only when an actual remote and revision are known.

Distinguish:

- **Observed in source:** directly supported by inspected implementation/configuration.
- **Test expectation:** strong contract evidence from inspected executable assertions and setup; cite the test and distinguish executed, unexecuted, skipped and mocked coverage.
- **Executed:** command, environment and actual result observed during this run; application runs follow [the runtime evidence pass](runtime-evidence.md).
- **User-stated:** an answer recorded in `questions.md`; cite its `Q-NNN` ID. Source code overrides it on contradiction.
- **Inferred:** interpretation, supporting evidence and what would confirm it.
- **Unknown:** missing evidence and its effect on copying, behavior or analysis.

Document current behavior, including apparent defects. Put proposed behavior and refactoring suggestions in separate labeled sections. A test/implementation contradiction is an unresolved discrepancy. Avoid secret values and personal data in examples; document configuration names and semantics. Framework defaults need evidence from the installed version/configuration or execution.

## Feature page contract

Each feature has a functional page and a technical page. Add as many extra pages under `features/<stable-feature-id>/` as the feature needs to stay readable, for example one page per screen when a feature has many screens, linked from the functional page. Size sections to the feature. State “not applicable” with a reason for irrelevant dimensions, and “unknown” for missing evidence.

### Functional page: `features/<stable-feature-id>.md`

Written from the user's or caller's perspective, so it can serve as a specification for rebuilding the feature on any stack. Use the user's vocabulary from visible labels. Keep implementation terms (classes, modules, frameworks, tables) out of the prose; cite evidence with compact labels and links instead.

1. **Summary:** stable ID, name, who uses it, the outcomes it offers, included/excluded behavior, related features, inspected snapshot and status.
2. **Access:** how the user or caller reaches it: menu path, route or URL, endpoint, command; required roles and permissions.
3. **Interface:** for each screen, its purpose, regions, displayed data, actions, forms with fields and validation, and empty, loading, error and dialog states. For an API, each operation's request, response and errors from the caller's view. For a CLI, commands, options, output and exit codes. Link screenshots when a runtime pass produced them.
4. **User journeys:** one per outcome the feature offers, as step-by-step scenarios for the normal path, alternatives and failures, with concrete inputs and visible outcomes.
5. **Business rules:** the rules the user experiences (validation, calculations, limits, permissions, state changes and side effects they notice), each with its evidence label.
6. **Messages:** user-facing strings verbatim in the primary locale, with their keys.
7. **Open functional questions:** unknowns, user-stated claims the source contradicts, and questions still to ask.

### Technical page: `features/<stable-feature-id>/technical.md`

1. **Implementation flow:** entry point → decisions → state/integrations → response/event. A small sequence/flow diagram when useful. Label runtime flows separately from import graphs.
2. **Contracts and dependencies:** public interfaces, data formats, storage/schema and migrations, errors, configuration/flags, external services and relevant ordering, transaction, retry, idempotency or concurrency rules.
3. **Participating source files:** a table of linked `SOURCE_ROOT`-relative path, symbols, responsibility, participation role (entry point/core/shared/adapter/schema/config/test), and evidence of participation. Include templates, migrations, assets and registration files. Mark shared files and relevant symbols when a file mixes features. Vendor packages are external prerequisites, not thousands of source rows.
4. **Copying this feature:** behavior to preserve (pointing to the functional page's journeys and rules), smallest evidenced source/resource set, transitive local dependencies, shared symbols to retain/adapt, integration/registration points, runtime prerequisites, data assumptions and migrations, portability blockers, and verification scenarios. This is a transfer brief, not a guarantee that copying files works. Distinguish whole-file copying from extracting symbols from a shared file. Record unresolved closure instead of calling it self-contained. Write it so an agent without source access could rebuild the feature on another stack:
   - **Known defects: decide, don't replicate.** List apparent defects and risks (silent failures, data-loss paths, missing validation, races) separately from the behavior to preserve, each with its evidence label, so a copy does not reproduce them by accident. Documenting them is not a recommendation to fix them.
   - **Presentation values** for features with a user interface: the values the feature actually applies, resolved to literal values (layout and breakpoints, colors per theme, typography, spacing that defines the look), including values inherited from shared stylesheets or marked untraced. Together with the functional page's interface and messages sections, this forms the rebuild specification. State “not applicable” for features without a user interface.
5. **Refactoring this feature:** observable invariants, inbound consumers, affected features/shared state, tests and gaps, plausible seams with tradeoffs, links to architecture findings. Proposed seams remain proposals.
6. **Evidence and open questions:** test locations and assertion scope, commands actually run/results or “not run”, runtime evidence pass results (scenarios run/passed/failed/not run, re-run command) or “not run”, `User-stated` answers used (by `Q-NNN`), conflicting evidence, missing pieces and consequences.

The technical page's source table is the authoritative feature-to-file mapping. Derive `source-index.md` from all feature source tables: each path links back to its features and records its roles. A file can legitimately appear in several features. The reverse index supports impact discovery; it is not a dependency graph.

An atlas written with the earlier single-page layout is migrated on refresh: keep `features/<stable-feature-id>.md` as the functional page and move implementation, source, copying, refactoring and evidence sections to `technical.md`.

## Durable tickets and session boundaries

Project-wide documentation uses [the ticket workflow](ticket-workflow.md): discovery/planning first, bounded ticket execution in fresh sessions, then integration and final checks. Planning has its own context, and each ticket executes in a separate fresh context. A whole-project request preserves the eventual scope without merging ticket sessions. Do not continue from planning into ticket execution or from one ticket to another in the same conversation. A planning pass does not create feature placeholders or mark features documented. Planning orders the queue in two waves: functional tickets and a functional review first, enrichment tickets second. Ticket handoffs capture source leads and remaining work; each execution session must verify those leads against current executable artifacts. Keep ticket status separate from feature status.

## Update discipline

Re-read relevant source before acting on an old page. Compare recorded snapshots with tracked, untracked and local changes where available. Recheck changed files' owning features, inbound consumers, schemas, configuration, tests and graph edges. Rescan surfaces (routes, menus, endpoints, commands) for added or removed screens and features, and update `surfaces.md`. Keep stable IDs unless meaning changes; retain an old-to-new mapping on renames/splits. Preserve unrelated documents. Within the requested documentation scope, revalidate existing explanations against executable evidence; correct or explicitly mark unsupported claims rather than carrying them forward as facts. Report removed behavior and its evidence.

## Quality bar

A reader who does not know the code, such as a product owner, understands what each feature lets users do from its functional page alone. A developer can navigate from there to the implementation. An LLM can find contracts, source slices, integration requirements, invariants and unknowns without loading every feature. Links resolve, source roles have evidence, and diagrams match their declared relation types. Coverage and uncertainty are visible; a polished page never substitutes for traced behavior.

## Authoring and tooling

Write documentation content directly as Markdown files, one page at a time. Use the bundled scripts for mechanical work: the [HTML renderer](../scripts/render_html.py) for every HTML page and render check, the [ticket scaffolder](../scripts/scaffold_tickets.py) for ticket pages and queue rows, and the dependency analyzer for graph views. Throwaway commands are fine for read-only discovery, such as listing registrations or counting routes in `SOURCE_ROOT`. Do not write converters, page generators or templating scripts, and do not hold documentation content in code; when a bundled tool cannot do something, report the limitation instead of rebuilding it.

## Browser-readable edition

Generate Markdown and companion HTML by default, following [the HTML publication contract](html-format.md). Read it before producing or checking output. Markdown is the canonical editorial source; HTML preserves its evidence, limits and substantive content. Deliver a navigable HTML index and sibling HTML pages for the pages in scope. The HTML contract defines collision handling, source hashes, offline diagrams, accessibility, rendering checks and refresh behavior. A presentation source hash is not evidence that source-code behavior is current.
