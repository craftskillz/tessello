# Surface-first feature discovery

Read before discovering features. Features are found from the outside in: first list everything the application exposes to its users or callers, then group those interaction surfaces into features. Applies the documentation contract's root separation and evidence labels.

## 1. Inventory the interaction surfaces

An interaction surface is a place where a user or caller interacts with the application. Inventory them in this order of priority:

1. **UI screens:** pages, views, dialogs and wizards a person can reach. Find them through route definitions, navigation and menu components, page or view components, templates and the message catalog's titles.
2. **Public APIs:** endpoints, GraphQL operations, RPC methods or events consumed by callers outside the application. An endpoint called only by the application's own UI belongs to the screen that calls it, not to a separate surface.
3. **CLI:** commands, subcommands and their options.
4. **System triggers:** scheduled jobs, queue consumers, webhooks and startup tasks. These have no interactive user; inventory them so that nothing is left unattributed.

For an application with a UI, the screens drive the grouping and the other kinds attach to them. For an API, CLI or library with no UI, the highest-priority kind present drives it.

Record each surface in `surfaces.md` with a stable surface ID, kind, visible name (title or label, verbatim), how it is reached (menu path, route or URL, parent screen, command line), the main actions it offers, the data it displays or accepts, required roles, its evidence and its assigned feature. Order the screens along the application's navigation (menu order, then parent-to-child). Account for every registered route, endpoint and command: assigned to a feature, excluded with a reason, or unresolved.

## 2. Use the running application only as a last resort

Static discovery from source is the default and is usually enough. Browser exploration costs far more tokens. Use it only when the source cannot list the screens, for example when navigation is built from server data, routes come from a remote configuration or CMS, or only a minified build is available. Record why static discovery was insufficient.

When exploration is needed, do not build or start the application yourself. Ask the user to start it and give its base URL, plus a test account if screens require authentication. Install Playwright in a scratch directory outside both roots, asking first when that needs network access. Then run a scripted, read-only crawl: follow navigation links and menus, record each reached screen's URL, title, headings, menu location and visible actions, and save screenshots in the scratch directory. Do not submit forms, delete records or trigger actions with side effects. Use a terse reporter, keep logs on disk, and read only the summary. Copy screenshots into `DOCS_ROOT` only after the user confirms the instance holds no real personal data.

Label surfaces found this way `Executed`. Locate the implementing source for each where possible; when none can be found, keep the surface with its source location recorded as unknown.

## 3. Group surfaces into features

A feature is a menu area or business object: the set of surfaces where users work with one kind of thing, for example "Orders" with its list, detail, creation and cancellation screens. The individual outcomes it offers (place an order, cancel an order) are user journeys inside the feature, not separate features. Group surfaces using signals visible to the user, strongest first:

1. They sit under the same menu or navigation branch, or share a route prefix.
2. They operate on the same business object (the same entity in their forms, lists and endpoints).
3. They form one journey: one screen leads to the next through links, redirects or wizard steps.
4. They share vocabulary in titles, labels and message keys.
5. They require the same role or permission.

Attach public API operations and system triggers to the feature whose business object they act on; document them in that feature's interface and journeys. A trigger or API with no matching feature becomes its own feature, documented from the caller's or trigger's perspective. A single screen can serve several features (for example a dashboard); assign it to its main feature and list it as shared by the others.

Record, for each feature, which signals grouped its surfaces. When signals conflict or are weak, ask the user a targeted question rather than guessing. The answer is `User-stated` evidence, recorded in `questions.md`.

Name features in the user's vocabulary, taken from menu labels and screen titles, not from class or module names. Give each a stable ID. Order the feature inventory along the application's main navigation. Shared infrastructure without its own surface (authentication plumbing, persistence layers, design systems) is a shared concern, not a feature.

## 4. Confirm the grouping

Present the proposed features with their surfaces and grouping signals. Ask only about groupings the evidence cannot settle, and continue with the unambiguous ones. The inventory is complete for the inspected scope when every surface is assigned, excluded with a reason or unresolved.
