# Retrodoc HTML publication contract

Read when producing or checking browser-readable Retrodoc documentation. Markdown remains the canonical editorial source; HTML is a generated, equally complete reading edition. This contract specifies presentation, not new evidence or permission to publish. Preserve the documentation contract's English language, root separation, evidence rules and scope.

## Output and synchronization

Produce both formats by default for every generated or refreshed documentary page. Keep each HTML sibling beside its Markdown source (`features/orders.md` → `features/orders.html`). The selected atlas index (`README.md` or `RETRODOC.md`) maps to `index.html`. Reuse only recognized Retrodoc output; if `index.html` belongs to something else, select `retrodoc-index.html` when free and record it as `html_index` in `retrodoc-context.json`. Never overwrite unrelated HTML. Keep the existing context `index` field as the Markdown index.

JSON graph data stays JSON. Every retained Markdown graph view gets a corresponding HTML view. Optional pages only get HTML when their source page exists. Discovery mode creates an HTML inventory and coverage, not fabricated feature dossiers. Help alone creates no output. Check-only mode writes paired check reports but does not regenerate other pages without a refresh request.

Each HTML page identifies its Markdown source, inspected revision/date, rendering date, feature status and scope. Carry a SHA-256 of the exact source Markdown bytes in a `retrodoc-source-sha256` meta tag and an encoded relative Markdown path in `retrodoc-source`. This detects rendering drift, not behavioral correctness. Preserve untouched pages' original inspection dates. Regenerate affected HTML after the last Markdown change; never maintain contradictory facts in two formats. Update inbound navigation when a page moves. Record incomplete renders explicitly.

Render documentation links to existing HTML counterparts, retaining fragment semantics through stable IDs. Keep source-code citations pointing to source artifacts, never substitute documentation for evidence. Compute links from each output's actual directory, percent-encode path segments, and preserve known commit permalinks. Display source path and symbol even when a browser cannot open a local source file. Explain local-link limits when hosting is requested. Do not embed an absolute machine path as if it were a portable website link.

## Rendering with the bundled renderer

Produce every HTML page by running the bundled [renderer](../scripts/render_html.py). It needs only Python 3.9+ and the standard library. Resolve `<installed-skill>` to the directory containing the installed top-level `SKILL.md`, even when reading this contract from `references/`:

```sh
python3 "<installed-skill>/scripts/render_html.py" "<DOCS_ROOT>"                  # render new or changed pages
python3 "<installed-skill>/scripts/render_html.py" "<DOCS_ROOT>" features/orders.md # render selected pages
python3 "<installed-skill>/scripts/render_html.py" "<DOCS_ROOT>" --check          # verify without writing
```

Do not write a Markdown converter, an HTML template or a page generator, and do not embed documentation content in scripts. Write each page's content directly as a Markdown file, then run the renderer. If the renderer fails or lacks a construct you need, report the limitation and leave the affected HTML marked incomplete instead of building a replacement.

The renderer embeds the bundled CSS, adds the source path and SHA-256 meta tags, rewrites documentation links to their HTML counterparts, escapes raw HTML, drops unsafe URL schemes, de-duplicates heading IDs and skips pages whose source hash and index location are unchanged. It never overwrites HTML that lacks Retrodoc source metadata, and it selects and records `retrodoc-index.html` when an unrelated `index.html` exists. Supply page metadata and structure in the Markdown so both formats stay identical:

- Optional front matter between `---` lines at the top of the page: `status`, `scope`, `snapshot` and `inspected` (simple `key: value` lines). These fill the metadata strip.
- `# Title`, then one plain paragraph: the title and outcome sentence.
- A `## Key reading` section: rendered as the key-reading callout.
- Each `##` section becomes a card and a table-of-contents entry; tables, nested lists, blockquotes, fenced code, links and images are supported.
- Diagrams: a fenced `svg` block is sanitized and embedded. A fenced `mermaid` block immediately followed by its `svg` equivalent renders as that figure with the Mermaid source collapsed below it; a `mermaid` block without one is flagged as an incomplete diagram and fails `--check`.

`--check` verifies source hashes, the source path meta tag, local links and fragments, unique IDs, incomplete diagrams and navigation back to the HTML index, and exits non-zero on any problem. It does not check content parity beyond the hash, accessibility or visual layout; those remain the checks described below.

## Page anatomy

Use semantic HTML (`header`, labeled `nav`, `main`, `article`, `section`, `footer`) with correct language and a single h1. Include:

1. A skip-to-content link and compact breadcrumb back to the atlas.
2. An editorial title, one sentence explaining the page's outcome, and a metadata strip with snapshot, scope and explicit documentation status.
3. A table of contents linking to stable section anchors. On wide screens a restrained sticky side rail is useful; on narrow screens move navigation above the content. Sticky elements must not cover anchor targets.
4. A key-reading block: what is established, the main limit, and where to look next. Do not manufacture recommendations for descriptive pages.
5. Substantive sections and diagrams, followed by evidence and open questions. Core content remains visible without JavaScript. Use native `details` only for ancillary logs and long evidence excerpts, with informative summaries.
6. Links to the Markdown source, the atlas, and genuinely related existing pages.

The index is a compact atlas: feature/outcome/status table or cards ordered along the application's navigation, coverage and architecture links, and an explicit unresolved section. Feature functional and technical pages preserve all their Markdown contract sections; do not compress away copy prerequisites or error contracts for appearance. Architecture findings use a card per finding with evidence, confidence, impact, counterevidence, proposed separation and verification. Check reports separate structural, semantic and execution results; passing link checks never mean behavior was verified.

## Visual system

Aim for a calm technical publication, not a dashboard of decorative metrics. Use [the bundled CSS](../assets/retrodoc.css) as the baseline, adapting layout to the document rather than copying fixed screens.

- Warm neutral background, white cards, charcoal text; teal for navigation and emphasis, amber for cautions, red for evidenced defects. Reserve color for meaning and pair it with text or symbols.
- System sans-serif body at 16px with 1.6 line height; restrained system serif headings; system monospace for identifiers. No remote fonts. Use a 4/8px spacing scale, 24–32px section padding, 12px corners and thin borders. Avoid heavy shadows and gradients.
- Limit prose to approximately 70–80 characters per line; allow diagrams and tables to span the content area. Keep a consistent heading hierarchy and generous section separation.
- Match light and dark palettes with readable contrast (target WCAG AA: 4.5:1 ordinary text, 3:1 large text and meaningful graphical controls). Muted evidence text must remain legible. Honor `prefers-color-scheme`, `prefers-reduced-motion` and print media.
- Use labeled badges for `discovered`, `partial`, `documented`, `stale`; distinguish these from evidence labels `Observed in source`, `Test expectation`, `Executed`, `Inferred`, `Unknown`. Confidence and recommendation priority are separate dimensions. Avoid green badges that imply tests passed without execution.
- Give tables captions and scoped header cells. Wrap wide tables in labeled horizontal-scroll regions instead of shrinking text. Keep filenames wrappable. At 375px the page must not overflow horizontally; only explicitly scrollable diagrams/tables may do so.

## Diagram grammar

Choose a diagram for a question: sequence for temporal interactions, flow for decisions, state machine for transitions, dependency graph for typed relationships, cross-section for responsibility distribution. Do not make every figure a generic box chain.

State the relation type and granularity in a caption. Use explicit arrow direction and a small legend. Distinguish observed relationships from inferred/unresolved ones with labels as well as dashed strokes. Never mix runtime calls and imports without a legend and separate edge labels. Link figure references to evidence already recorded in Markdown or the graph dataset.

Before/after pairs are appropriate for refactoring proposals, not obligatory for descriptive documentation. Label them `Current — observed` and `Proposed — not implemented`; carry the proposal's uncertainty and verification conditions. Use two columns on desktop and stack them on mobile. Do not invent a future state to fill the second panel.

Prefer inline SVG with a viewBox, accessible title/description and a nearby text summary. Use adequate internal padding and readable labels at actual display size; split dense graphs into overview and focused views. Maintain stable node identities and edge direction when changing layout. Keep dependency counts sourced from the dataset, not hand-edited decoration.

For Mermaid source in Markdown, render to SVG at build time when an available local renderer supports it; embed the resulting SVG. A hand-authored equivalent is acceptable if verified against the source graph and labeled with the same relation types. Never expose raw Mermaid as the only browser diagram or require a CDN. If rendering cannot be completed, preserve the source and accessible relation list, mark the HTML diagram incomplete and report the limitation.

## Self-contained and safe rendering

Each page's styling and diagrams are embedded: no CDN, external fonts, network fetches or JavaScript required for reading. Multi-page navigation uses relative links and works via `file://` as well as a static server. No server is needed merely to read the atlas. Optional enhancements must preserve the no-script reading path.

Escape source-derived text and attribute values; treat filenames, comments and code excerpts as data. Allow only intentional local anchors, relative artifact links and validated HTTP(S) evidence links. Reject executable URL schemes. Sanitize rendered Markdown and SVG rather than copying arbitrary source HTML/scripts. Do not turn repository content into executable browser code. Use unique figure IDs to avoid collisions between embedded SVGs.

Print CSS removes navigation chrome, retains metadata and evidence, expands ancillary details, and prevents clipped tables/diagrams. Break long cards naturally; avoid forcing an entire large article onto one printed page.

## Verification and delivery

Run the renderer with `--check` for each generated page's source hash, local links/fragments, unique IDs and navigation back to the chosen HTML index, and fix what it reports. Content parity holds by construction when every page is rendered from its Markdown; review only content the renderer reported as dropped or incomplete. HTML is a projection: semantic checks still trace claims to executable artifacts.

Open representative index, feature and architecture pages in a real browser when available. Inspect desktop and 375px mobile widths, light/dark themes, keyboard focus, no-script readability and print preview. Check for overlapping labels, clipped diagrams, unreadable tables, stale badges and missing sections. Verify no external resources load. State which visual checks were actually performed; if no browser is available, report visual verification as not run, not passed.

Return the browser entry point and Markdown index, changed scope and actual validation results. Rendering locally does not authorize hosting, deployment or publication. Do not introduce a web framework/build stack just to present this documentation.
