# Retrodoc

Produce an evidence-backed description of the project as it exists. Keep the source project separate from the invocation directory where documentation is written. This skill includes the supporting workflows it needs; resolve resource links relative to the file containing each link. Read [the documentation contract](../documentation-contract.md), especially its English-language and evidence policy, before discovery or writing. Executable artifacts are the definitive evidence and executable tests are strong evidence; user answers are strong evidence that source code overrides; ADRs, other documentation and explanatory comments are not evidence.

## Recover the workspace

Capture the invocation directory as `DOCS_ROOT` and follow the documentation contract's source/output root procedure. Inspect local `retrodoc-context.json` and its saved queue (default `tickets/index.md`) before asking for a source path or choosing a mode. Restore valid saved roots automatically; ask for the source path only when neither the request nor usable workspace metadata supplies it. Pass validated roots to every subskill. Output stays directly in `DOCS_ROOT` throughout the run.

## Choose the mode

- **Resume (default for an existing workspace):** for bare `$retrodoc` or a request to continue/resume without a new scope, follow [workspace recovery and ticket selection](../ticket-workflow.md#workspace-recovery-and-ticket-selection). Resume the unfinished ticket or execute the next ready ticket in this fresh session. Preserve the inventory, stable IDs, completed outputs and queue. Report completion or blockers when no ticket can run.
- **Discover and plan (default for a new workspace):** use when no resumable plan exists or the user explicitly requests planning or a new project-wide scope. Discover features and produce a two-wave queue of bounded Retrodoc tickets using [the ticket workflow](../ticket-workflow.md): functional tickets and a functional review first, enrichment tickets second. Then stop after Pass 1. A functional-only request plans wave 1 and the review only. With a partial inventory, continue planning from its recorded coverage and recheck source leads rather than discarding prior work. Users do not need to supply feature names.
- **Discovery only:** use when the user only asks to discover/list/map features or wants to choose before planning. Deliver the inventory, `surfaces.md` and coverage without tickets or dossiers unless requested.
- **Execute a ticket:** when the user names an existing ticket, follow Pass 2 of [the ticket workflow](../ticket-workflow.md). Use a fresh conversation for that ticket, recheck source freshness, finish its bounded work and handoff, then stop.

A request to document the whole project sets the eventual scope; it does not combine ticket execution into one conversation. Planning and every feature, architecture and validation ticket use separate fresh contexts. Follow the [session boundary rules](../ticket-workflow.md) even when the full queue is requested. If this conversation already performed planning or another ticket, return the handoff prompt instead of beginning a new ticket here.

A statement that the user does not know the project is not a request to make them name its features. If they ask for guidance rather than execution, follow [retrodoc-help](../../SKILL.md).

## Discover and organize

1. Read project instructions for constraints relevant to documentary work, applying the documentation contract's scope rule: analyzing a source repository does not activate its development workflow. Record the inspected revision and local modifications, or a dated snapshot when Git is absent. Scope vendor, generated and build output separately. Use existing documentation only as output to check or update, never as a factual discovery source.
2. Follow [surface-first discovery](../surface-discovery.md): inventory the interaction surfaces (UI screens first, then public APIs, CLI and system triggers) in `surfaces.md`, then group them into features using the user-visible signals it lists. Explore the running application only when static discovery cannot list the screens, and only against an instance the user starts. In monorepos, namespace feature IDs by application when names collide.
3. Create a feature inventory with stable IDs, user-vocabulary names, surfaces, grouping signals, evidence, status and documentation links. Record shared infrastructure separately. State which roots and registration mechanisms were inspected; avoid exhaustive-discovery claims when reflection or unavailable services leave gaps.
4. Present the proposed grouping while continuing unambiguous work. Ask targeted questions only where grouping signals conflict or code cannot settle a boundary, and record answers in `questions.md`. Write Markdown in English for developers and LLMs, in the captured `DOCS_ROOT`.

Done when the index gives a bounded inventory, not just a sample of interesting features, and every surface is assigned, excluded with a reason or unresolved.

## Deliver discovery only

For discovery-only requests, write the context file, index, `surfaces.md` and `coverage.md` in `DOCS_ROOT`. The inventory lists stable feature IDs, user-vocabulary names, actors, outcomes, surfaces with their evidence, grouping signals, boundaries and uncertainties. Mark new entries `discovered`; preserve existing page statuses unless new evidence makes them stale. Link only pages that actually exist; indicate “not yet documented” for missing dossiers rather than creating placeholders or broken links.

Validate cited files and surfaces, index links and the stated coverage. Report this as discovery, not a completed feature-documentation or architecture review. Present a numbered selection with stable IDs and short outcomes, and ask which features the user wants to document next. Wait for their selection before producing dossiers. An inventory is complete for the inspected discovery scope when every found surface is accounted for and unresolved areas are explicit; do not imply the entire project is understood.

A later selection continues with [retrodoc-feature](retrodoc-feature.md) for the selected items, reusing established roots within the same workflow. A request to document everything continues with the remaining phases below. Keep discovery-only output separate from full-run completion criteria.

## Deliver the planning pass

For default discover-and-plan mode, follow [Pass 1](../ticket-workflow.md) after discovery. Produce the queue and self-contained tickets, validate their coverage/links and publish both formats. Return the next ready ticket and a fresh-session prompt. Do not create placeholder feature dossiers or describe planning as a completed atlas.

## Document and connect

For the one ticket selected in a fresh session, read and follow [retrodoc-feature](retrodoc-feature.md) for each in-scope feature, running the phase its ticket type names: the functional page in wave 1, enrichment from source, user answers and optional runtime evidence in wave 2. The review ticket between the waves follows [the ticket workflow](../ticket-workflow.md). Finish one feature before expanding to the next. Keep inventory statuses accurate. For large projects, save inspected sources, unresolved paths and next steps in `coverage.md` so work can resume without treating unfinished pages as verified.

Read and follow [retrodoc-architecture](retrodoc-architecture.md) to build typed dependency evidence, diagrams and separation findings. Include this phase in a full-project run; a user-limited feature run needs only the relevant dependency slice and its stated limits.

Maintain the index, `surfaces.md`, `questions.md`, shared-concern pages, glossary, reverse source index and coverage record using the documentation contract. Every project claim must trace to executable artifacts or a recorded `User-stated` answer. When updating existing pages, verify their claims anew; correct unsupported prose and surface disagreements between executable tests and implementation.

## Verify and deliver

Read and follow [retrodoc-check](retrodoc-check.md). Fix documentation errors within the requested scope. Report pages produced, inspected scope, validation performed, unknowns and unfinished features. Full-atlas completion means all in-scope inventory items are documented or explicitly unresolved with reasons, tickets accurately reflect that state, and the check report has no unreported failures. Planning-pass completion is defined separately in the ticket workflow. Distinguish completed documentation work from unverified runtime behavior.

This workflow writes documentation and analysis artifacts. Copying features, refactoring code, publishing docs and opening issues are separate tasks requiring a user request.

## Publish the local reading edition

Follow [the HTML publication contract](../html-format.md): write canonical Markdown, then produce sibling HTML pages only by running its bundled renderer, never a hand-written converter. Refresh the HTML atlas navigation for pages actually produced. Preserve all evidence and unknowns; label future-state diagrams as proposals. Validate the reading edition and return both entry points. Discovery-only scope remains an inventory and coverage, without feature placeholders.
