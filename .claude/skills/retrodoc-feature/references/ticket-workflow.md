# Ticket-based documentation passes

Use this workflow for project-wide documentation. A first pass creates an evidence-backed plan in its own session; each execution ticket then uses a separate fresh conversation. The ticket and its durable handoff replace reliance on the planning conversation. The purpose is to bound context growth and repeated reading; actual cost depends on the project and model and is not guaranteed. Tickets are local Markdown artifacts, not external issues. Do not create issues or send messages without a separate request.

## Pass 1: discover and plan

Establish SOURCE_ROOT and DOCS_ROOT using the documentation contract. Discover features with [surface-first discovery](surface-discovery.md): inventory the interaction surfaces in `surfaces.md`, then group them into features. Ask only targeted questions where grouping signals conflict, and record answers in `questions.md`; do not require users to name features. Do not deeply document every feature in this pass.

Write location metadata, the bounded feature inventory, `surfaces.md`, coverage and the queue at the saved `ticket_queue` path (default `tickets/index.md`). Plan the documentation in two waves, with stable `RD-NNN` IDs, so the user sees the whole application functionally before any technical enrichment:

1. **Wave 1, functional:** one `functional` ticket per feature, carrying its surfaces. It writes the functional page from the outward-facing layer and records open questions without asking them. Then one `review` ticket, depending on every functional ticket: it presents the functional atlas and asks all open questions in one batch.
2. **Wave 2, enrichment:** one `enrichment` ticket per feature, depending on its functional ticket and on the review ticket. It completes the functional page and writes the technical page from source code, remaining questions and the optional runtime pass.

List every wave-1 ticket before any wave-2 ticket in the queue. When a feature is too large for one session, split its tickets by screen group: each writes its screen pages under `features/<stable-feature-id>/`, and the ticket owning the feature's page depends on the others. Avoid one ticket per file or a ticket that requires understanding the entire product. Add shared-concern tickets only when evidence shows a reusable contract, plus architecture-integration and final-validation tickets. Record actual dependencies; do not impose an arbitrary serial chain. Architecture tickets depend on the enrichment tickets whose source mappings they use; final validation depends on the pages/graphs in scope.

When the user asks for a functional-only atlas, plan wave 1 and the review ticket only. Enrichment tickets can be added later by replanning; the scaffolder appends them without touching existing tickets.

Check every discovered surface is attributed and every planned deliverable has an owner. Each ticket needs a runnable first inspection step and bounded acceptance criteria. If discovery cannot settle a boundary, create an investigation ticket with a question and completion criterion rather than inventing behavior. Existing partial dossiers may seed tickets but are unverified outputs to recheck, not factual evidence.

Create ticket pages and queue rows with the bundled [ticket scaffolder](../scripts/scaffold_tickets.py) rather than writing each ticket by hand. Write a temporary planning file outside `DOCS_ROOT`, for example in a scratch directory:

```json
{"version": 1, "source_root": "<SOURCE_ROOT>",
 "snapshot": {"revision": "<full sha>", "dirty": "clean", "inspected": "YYYY-MM-DD"},
 "tickets": [{"id": "RD-001", "type": "functional", "title": "Orders",
              "objective": "Document what customers can do with orders.", "features": ["orders"],
              "actor": "Customer", "outcome": "Orders placed, followed and cancelled",
              "surfaces": [{"kind": "screen", "name": "My orders", "access": "Menu › Orders, /orders"},
                           {"kind": "screen", "name": "Checkout", "access": "Cart › Checkout, /checkout"}],
              "include": ["..."], "exclude": ["..."],
              "leads": [{"path": "src/orders.py", "note": "`place_order`"}],
              "tests": [{"path": "tests/test_orders.py", "note": "assertions not yet inspected"}],
              "deps": [],
              "unknowns": ["..."], "first_step": "Read `place_order` in src/orders.py.",
              "acceptance": ["optional extra criteria"], "outputs": ["optional; defaults by type"]}]}
```

```sh
python3 "<installed-skill>/scripts/scaffold_tickets.py" "<DOCS_ROOT>" "<plan.json>" --dry-run
python3 "<installed-skill>/scripts/scaffold_tickets.py" "<DOCS_ROOT>" "<plan.json>"
```

`surfaces` is optional; each entry needs `kind` and `name`, with `access` describing how the user reaches it. The scaffolder validates IDs, types, surfaces, dependencies and that every lead exists under `SOURCE_ROOT`; it writes nothing when validation fails. It applies the ticket contract template with type-specific acceptance criteria, computes `ready`/`blocked` from dependency status, creates the queue at the saved `ticket_queue` path or appends rows for new tickets, and records ticket status in each ticket's front matter. It never overwrites an existing ticket, so rerunning it after a replan adds only new IDs. Afterwards, edit tickets and the queue directly; the planning file is disposable and is not an authoritative record. Write the index and `coverage.md` as Markdown files directly.

Publish paired Markdown/HTML inventory, coverage and ticket pages by running the [HTML renderer](html-format.md#rendering-with-the-bundled-renderer). Link only existing dossiers. Stop after planning and present the recommended ready ticket with a copyable fresh-session prompt. This is completion of Pass 1, not completion of the atlas. Do not start the first execution ticket in the planning context, even when the eventual request covers the whole project. Save the plan and give the next fresh-session prompt.

## Workspace recovery and ticket selection

For bare `$retrodoc` or a continue/resume request in an existing documentation workspace, recover the saved work before starting discovery:

1. Read local `retrodoc-context.json` when present and its `ticket_queue`, defaulting to `tickets/index.md` when the field is absent. Use the context's index and `coverage.md` only as needed to recover incomplete planning. These artifacts carry location, scope and progress; executable claims still require source reinspection.
2. Honor an explicitly selected ticket. Otherwise, prefer the sole `in_progress` ticket and its handoff. If several are in progress, present those IDs and ask which to resume. With none in progress, use saved `next_ticket` when it names a ready queue member with satisfied dependencies; otherwise select the first eligible `ready` ticket in queue order. A stale hint to a completed, blocked or absent ticket does not override queue state. Check dependencies and the selected ticket's actual status/acceptance record; a queue label alone cannot satisfy a prerequisite. Preserve blocked, unresolved and completed tickets. Surface missing ticket files or conflicting progress records for repair rather than silently skipping or resetting them.
3. Read only the selected ticket and required dependency outputs. Validate its roots against the invocation directory and saved context using the documentation contract. If context is absent, matching roots in the selected ticket can restore it after validation. State the recovered roots, ticket and next action, then follow Pass 2 in this fresh conversation without asking the user to supply those paths again.
4. If every ticket is done, report the recorded completion and any known validation limits, then stop. If no ticket is runnable and work remains, report blocked/unresolved items and missing prerequisites; ask only for information needed to proceed. Neither case restarts discovery or creates a replacement queue. An explicit refresh/replan request can change the scope while preserving existing IDs, outputs and progress where applicable.
5. If there is no queue, inspect the recognized index and coverage for unfinished discovery/planning. Continue Pass 1 from that handoff, revalidating source leads and preserving completed work. With no saved work, use the ordinary new-workspace planning flow.

Recovery preserves the session boundary: after planning or executing a different ticket in this conversation, return the saved handoff and a fresh-session prompt. A bare invocation in that same conversation does not start another ticket. After planning and each ticket, persist roots, queue path and the recommended `next_ticket` in context, and current status, dependencies, remaining work and next action in the queue/ticket handoff so the next session can recover from disk. An unfinished ticket remains the next recommendation; otherwise recommend an eligible ready ticket or set the hint to null when none is runnable. Refresh dependency readiness as prerequisites finish, without clearing blockers that name other missing requirements.

## Ticket contract

Each ticket contains enough context to execute without the planning conversation:

- Stable ID, title, type (functional/review/enrichment/shared/investigation/architecture/check), status (the `status:` front matter line) and owning feature IDs. A `feature` ticket in an older queue covers both waves for its feature in one session.
- Absolute source root, output root, inspected revision and dirty state (or dated non-Git snapshot), plus index/context paths relative to the output root.
- Observable documentary objective, actor/trigger/outcome where known, the feature's interaction surfaces and how they are reached, included/excluded scope and exact output files (functional page, technical page and any extra pages). Keep intended behavior separate from observed behavior.
- Executable starting points: source-root-relative paths, symbols/registrations and tests with the assertion scope already inspected. These are leads to re-read, not proof carried across sessions. Never use repository prose as evidence.
- Dependencies by ticket ID and what evidence/deliverable they provide; independent work remains independently ready.
- Concrete acceptance criteria for the ticket's type: functional page sections written from the user's perspective for functional tickets; answered and still-open questions for the review; behavior/failures/state contracts, participating-file table, copy/refactor limits and source citations for enrichment; plus index/coverage updates and HTML parity. Architecture/check tickets use their respective contracts.
- Known unknowns and a short inspection plan, including the next exact file/symbol to inspect. Record runtime checks separately from documentary checks; application execution is optional unless the user requests it. When the user opts into runtime evidence during planning, add an acceptance criterion such as “Runtime evidence pass requested” to each enrichment ticket it applies to, so the executing session follows [the runtime evidence pass](runtime-evidence.md) without the planning conversation.
- Handoff: inspected files/ranges and findings with citations, questions asked and their `Q-NNN` IDs, outputs changed, validations actually run, unresolved paths, remaining work and the next action. Do not dump raw conversation or sensitive values.
- A fresh-session invocation that names this ticket and tells the agent to work from DOCS_ROOT.

Maintain the queue at `ticket_queue` (default `tickets/index.md`) with ID, objective, status, dependencies and links; preserve that path during recovery and updates. Ticket states are `ready`, `in_progress`, `blocked`, `done`, `unresolved`; these are distinct from feature statuses. A ticket is ready only when its required dependencies are satisfied. Blocked means a named missing prerequisite prevents progress; unresolved means a bounded investigation concluded with an explicit evidence gap accepted by the relevant scope. Neither state silently counts as verified behavior. A ticket is done only after its acceptance criteria and documentary validation are satisfied.

## Session boundaries and efficient context loading

Use a genuinely fresh conversation for each ticket. A summary, compaction or rereading the ticket in the same conversation is not a fresh context. A single context may work on at most one execution ticket; a large unfinished ticket may resume in another fresh session with its updated handoff. If the current conversation already performed discovery/planning or a different ticket, preserve the handoff and direct the user to start a new conversation instead of executing the next ticket here.

Load the selected ticket, location metadata, relevant queue rows and required dependency outputs. Read only the applicable workflow references and executable source needed for that bounded trace. Follow local dependencies when necessary, but do not reload every dossier, the whole queue's handoff history, the entire source tree or the planning transcript. Use the revision/local-change comparison to decide which additional evidence needs reinspection. Reserve full registration rescanning and atlas-wide reconciliation for their integration/check tickets unless local drift requires them sooner.

The default handoff is a copyable prompt for a new conversation. Do not claim to reset this conversation or silently launch subagents. If the user explicitly requests orchestration and a tool can create independent fresh contexts, that orchestrator may run the queue with one ticket per context and durable handoffs; otherwise stop at the boundary. Independent contexts must receive the ticket and required artifacts, not the parent conversation history.

## Pass 2: execute one ticket

A ticket selected explicitly or through workspace recovery supplies its source/output context; validate and state the paths rather than asking for the same source selection again. Capture the invocation directory as DOCS_ROOT. If it differs from the ticket's output root, stop to resolve the destination instead of writing into two atlases. Check existing context for source identity conflicts.

Read the selected ticket, queue dependencies, applicable documentation contract and only the relevant bundled feature/architecture/check workflow. Compare HEAD and local changes with the ticket snapshot; re-read executable evidence before accepting claims. If drift changes scope or prerequisites, update the ticket/coverage and investigate affected boundaries before continuing. Prior-session prose and hashes do not establish current correctness.

Mark the ticket in_progress, complete its bounded work as defined by its type and outputs, and validate that slice in Markdown and HTML. Update the atlas, source mappings, coverage and ticket handoff. Mark done only when its acceptance criteria hold; otherwise record the specific remaining gap and accurate status. Do not implement application changes.

End the session after the selected ticket with its status, outputs, checks, unresolved work and the next ready ticket's fresh-session prompt. Stop after that handoff. A request covering several tickets or the whole project still requires a separate fresh context for each ticket; it does not authorize a same-conversation loop. If the ticket remains unfinished, the next prompt resumes that same ticket. Splitting work into tickets does not itself authorize delegation.

Feature tickets follow [retrodoc-feature](../SKILL.md) for their wave. The review ticket reads the index, `surfaces.md`, `questions.md` and each functional page's summary and open questions, not the source. It updates the index into a functional overview of the application ordered along its navigation, asks every open question in one batch of numbered questions grouped by feature, records the answers in `questions.md`, updates the affected functional pages, and leaves unanswered questions open for wave 2.

## Pass 3: integrate and verify

Execute each architecture/integration ticket in its own fresh context to reconcile typed dependencies, diagrams, shared concepts, glossary and reverse source index across completed feature mappings. Then execute the final validation ticket in another fresh context: rescan routes, menus, endpoints and commands against `surfaces.md` for coverage changes, check source freshness, reconcile unresolved items and validate both reading editions. Avoid claiming the full project is documented while tickets remain incomplete. Report done/unresolved/blocked counts and the exact remaining scope.

## Fresh-session prompt

Start a new conversation from DOCS_ROOT, then paste this prompt adapted with actual established paths and an existing ticket. Do not paste the planning transcript:

For automatic selection, simply invoke `$retrodoc` in that directory: it resumes the unfinished ticket or selects the next ready one. Use the explicit prompt below to pin a particular ticket.

```text
Work from <DOCS_ROOT>. Use $retrodoc to execute only tickets/RD-NNN.md.
The ticket supplies SOURCE_ROOT and the inspected snapshot. Validate both roots,
recheck source freshness, finish the ticket's documentation and checks, update
its handoff and queue, then stop. Do not modify the source application.
```

If the named skill is not installed, ask the agent to read the available standalone Retrodoc SKILL.md and follow its bundled ticket workflow. Do not require companion installation.
