---
name: retrodoc-feature
description: Document an existing feature functionally from the user's perspective, then enrich it from source code, user answers and optional runtime evidence, including participating files and copying or refactoring guidance. Use for a focused feature dossier, not implementing the copy or refactor.
---

This skill is independently installable. Supporting workflows and tools are bundled locally; follow their links only when needed. Companion skills do not need to be installed. Use bundled procedures directly when this workflow calls for them.

# Document a feature

Read [the documentation contract](references/documentation-contract.md), including its English-language and evidence policy, before tracing the feature. It can run without an existing atlas by creating a minimal index for the requested scope.

When invoked for a Retrodoc ticket, inherit its selected scope and validated roots, follow [the ticket execution and handoff rules](references/ticket-workflow.md), use a fresh conversation for that ticket, and stop after its handoff. Additional tickets require additional fresh contexts. A ticket is not evidence: re-read its executable source leads before accepting claims.

Before discovery, follow the contract's source/output root procedure: capture the invocation directory as `DOCS_ROOT`, recover valid saved roots or use supplied roots, and ask for the source path only when neither is available. In a parent Retrodoc workflow, inherit its validated roots without asking again. All documentation is written directly under `DOCS_ROOT`; source inspection uses `SOURCE_ROOT`.

## Select the feature

Accept a feature ID or name, a menu label, a screen title or URL, an endpoint, a command or an observable behavior; an exact internal name is not required. A feature selected by the parent workflow already satisfies this step.

If the user supplies no feature, inspect the inventory in `DOCS_ROOT` after establishing the source root. Use it as a navigation aid only: verify its source identity and the features' surfaces against current executable artifacts before presenting choices. Show stable IDs, short outcomes and statuses, then ask which feature or subset to document. Wait for the selection; do not choose an arbitrary feature or ask the user to invent names.

If no usable inventory exists, explain that discovery identifies features from the application's interaction surfaces and offer to run [retrodoc in discovery-only mode](references/workflows/retrodoc.md). If the user already requested discovery, proceed; otherwise wait for acceptance. Reuse the established roots, produce the inventory, and let the user select from it before returning here. If discovery finds no supported candidates, report the inspected scope and gaps rather than inventing a feature list.

For an ambiguous feature request, present concrete executable-backed matches and ask the user to choose.

A feature is a menu area or business object as defined in [surface-first discovery](references/surface-discovery.md); a request for one outcome (for example "cancel an order") documents the feature that contains it, focused on that journey.

## Choose the phases

- A `functional` ticket runs the functional phase only, then stops.
- An `enrichment` ticket runs the enrichment phase on an existing functional page.
- A direct request without a ticket, or a `feature` ticket from an older queue, runs both phases in order. A request for functional documentation only runs the functional phase.

## Document the feature functionally

Start from the feature's interaction surfaces in `surfaces.md` (screens, endpoints, commands). If they are missing, inventory them for this feature with [surface-first discovery](references/surface-discovery.md).

1. For each surface, read the outward-facing layer: page and view components, templates, forms and their validation, the message catalog, route and menu definitions, API schemas and handlers' request/response shapes, CLI parsers. Read executable tests that drive the feature from the outside (end-to-end, UI and API tests).
2. Write the functional page using the contract's functional sections: access, interface, user journeys, business rules and messages, in the user's vocabulary. Label each claim with its evidence. Leave rules that need a deeper trace as `Inferred` or `Unknown` rather than guessing.
3. Record what the outward-facing layer cannot settle (meaning, intent, suspected defects) as open questions on the page and as `open` entries in `questions.md`. In a functional ticket, do not ask them: the review ticket asks all open questions together. In a direct request, keep them for the enrichment phase's batch, or ask them in one batch now when only the functional phase was requested.
4. Update `surfaces.md` and mark the feature `functional` in the index.

## Enrich the feature

Start from the functional page and the answers already recorded in `questions.md`. Complete the functional page and write the technical page from three sources, in this order.

1. **Source code.** Follow implementation from trigger through decisions, state and side effects to outcome. Inspect failure branches, authorization and configuration gates. For a user-facing feature, trace the stylesheets and theme values actually applied. Trace registrations and dependency injection as well as direct calls. Follow important indirect dependencies until reaching an inspected local implementation, an external interaction established by local executable code/tests, or a recorded unknown. Correct the functional page where the code shows different or hidden rules. Build the participating-files table as you trace: include shared symbols, schema/migration, assets, registration and tests, and explain each role. Filenames and imports alone do not prove participation in a particular behavior. Derive the copy brief from dependency closure, including resources and environment requirements, the known-defects list and presentation values. Trace inbound consumers for refactoring impact. Record uncertainty where source access ends.
2. **Questions to the user.** Collect what the code cannot settle and the review left open: business meaning, intent, ambiguous rules, and behaviors that look like defects. Ask them together in one short batch of numbered questions, not one at a time. Record each question and answer in `questions.md` and cite its `Q-NNN` ID. Where an answer contradicts the source, document the code's behavior and keep the answer as a discrepancy. Unanswered questions stay open in the functional page; do not block on them.
3. **Runtime evidence.** If the user or the ticket opted into running the application, follow [the runtime evidence pass](references/runtime-evidence.md) now, targeting the pages' inferred and unknown items and verification scenarios, then update both pages with the results. Otherwise record the runtime pass as not run.

Then update the feature index, `surfaces.md` and the reverse source index, preserving other feature rows. Add observed dependencies to an existing architecture dataset when its schema is available; otherwise retain evidence in the technical page for later analysis. Check every source link and material behavioral assertion against inspected files.

Done when both pages' sections are substantive, every listed file has a role and evidence, and readers can distinguish source-verified behavior, user statements and transfer assumptions. Report inspected scope, questions asked and answered, test execution status and runtime evidence status. Do not implement suggested changes during documentation.

## Publish the local reading edition

Follow [the HTML publication contract](references/html-format.md): write canonical Markdown, then produce sibling HTML pages only by running its bundled renderer, never a hand-written converter. Refresh the HTML atlas navigation for pages actually produced. Preserve all evidence and unknowns; label future-state diagrams as proposals. Validate the reading edition and return both entry points. Discovery-only scope remains an inventory and coverage, without feature placeholders.
