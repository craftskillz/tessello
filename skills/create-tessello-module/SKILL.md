---
name: create-tessello-module
description: Create a Tessello Module, a sandboxed View with an optional Widget for the Tessello Host, packaged as a .zip that passes `tessello validate`. Use when the user wants to build, change or package a Tessello Module.
---

# Create a Tessello Module

You build a **Module** for the Tessello **Host**: a static web package (HTML, CSS, JavaScript) with one **View**, an optional **Widget** shown on the Host's Home, and a **User guide**. Each View and Widget runs in its own sandboxed iframe and talks to the Host only through messages, which the SDK wraps.

The contract is the **Convention**: https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md (raw text: https://raw.githubusercontent.com/craftskillz/tessello/main/convention/CONVENTION.md). Read it before writing code when you can fetch it; this skill names its section (`§n`) for each rule instead of repeating it. Working examples, one folder per package: https://github.com/craftskillz/tessello/tree/main/examples (`notes`: storage and a Widget; `meteo`: the `network` Permission; `prometheus`: the `localNetwork` Permission).

The work is done when the `.zip` passes `tessello validate` with **zero errors**. Publishing is the Creator's own step afterwards.

## Steps

### 1. Agree on the Module

With the user, settle before writing files:

- **What it does**, in a sentence: this becomes `description` (≤ 200 characters) and the opening of the guide.
- **The Module ID**, `@namespace/name` (§3, regex there). The namespace is the Creator's own: their GitHub account, lowercase (`@jane/pomodoro`). It identifies the Module forever: changing it later makes a different Module and the Users' data stays behind. A Module listed on the Marketplace must use the namespace of the GitHub account that publishes it. Ask for the account name when you do not know it.
- **A Widget or not**, and its size: `S` (1×1 cell), `M` (2×1) or `L` (2×2) (§7.1). Choose the smallest that shows something useful at a glance; a Widget is a preview that opens the View.
- **Permissions** (§3.1): every origin the Module contacts. `network` takes public `https://` or `wss://` origins; `localNetwork` takes `localhost`, loopback, private IPv4 or `.local` origins. No path, no trailing `/`. A Module with no `permissions` reaches no network at all, which is the right default. The API must answer CORS requests from origin `null`; check that before choosing it.

### 2. Lay out the package

The folder *is* the package (§2), with `manifest.json` at its root:

```
pomodoro/
├── manifest.json
├── icon.svg            # square; or a PNG of at least 256×256
├── guide.md
├── tessello-sdk.js     # the SDK, copied (step 3)
├── view/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── widget/             # only with a Widget
    ├── index.html
    ├── style.css
    └── app.js
```

Write `manifest.json` with the fields of §3: `convention` (always `1`), `id`, `name` (≤ 40 characters), `version` (`1.0.0` for a new Module), `description`, `icon`, `view.entry`, `guide`, and `widget.entry` with `widget.size` when there is a Widget, `permissions` when there are any. Every path is relative and points to a file of the package.

Write plain static files: no build step is needed. With a framework or TypeScript, the built output is the package, and the templates `craftskillz/tessello-template-svelte` and `craftskillz/tessello-template-typescript` on GitHub already set that up.

### 3. Use the SDK from a local copy

The SDK is one file. Copy it into the package root, never load it from a CDN at runtime (that would need a `network` Permission):

```sh
curl -fsSLo tessello-sdk.js https://unpkg.com/@tessello/sdk/tessello-sdk.js
# or: npm install @tessello/sdk && cp node_modules/@tessello/sdk/tessello-sdk.js .
```

When you cannot run commands, ask the user to save that URL as `tessello-sdk.js` at the package root.

Import it with a relative path from each entry page's script (`<script type="module" src="app.js">`):

```js
import { connect } from "../tessello-sdk.js";

const host = await connect();            // the `ready` handshake (§6.4); call it once, at startup
host.context.surface;                    // "view" | "widget"
host.context.theme;                      // { mode, colors: { background, surface, text, textMuted, accent, border } }
host.context.params;                     // View only: the params the Widget opened it with
host.context.locale;                     // e.g. "fr-FR"
await host.storage.get("key");           // null when absent
await host.storage.set("key", value);    // any JSON value except null
await host.storage.delete("key");
await host.storage.keys();
host.onThemeChange((theme) => apply(theme));
host.onVisibilityChange((visible) => (visible ? resume() : pause()));
await host.openView();                   // Widget only; or openView({ task: "42" }), params are strings
host.onNavigationParams((params) => show(params)); // View only, reopened while loaded
```

A refused request rejects with a `TesselloError` whose `code` is one of §5.1 (`quota_exceeded`, `invalid_payload`…).

### 4. Write the View and the Widget

Hold to the sandbox (§4) and the capabilities (§6); these are the rules generated Modules break most:

- **Storage** is the Host's (§6.1), shared by the View and the Widget, 1 MB per value and 5 MB in all. Save each change as soon as it happens: the Host unloads a View or Widget without warning. `localStorage`, `sessionStorage`, IndexedDB and cookies do not exist in the sandbox.
- **One page per surface.** Route inside the page with `location.hash`; `history.pushState`, navigating to another page and frames (`<iframe>`, `<object>`, `<embed>`) all fail.
- **Dialogs**: build them in the page; `alert`, `confirm` and `prompt` do not work.
- **Theme** (§6.2): apply `host.context.theme` at startup and on `onThemeChange`, at least `mode`, `background` and `text`; stay readable in light and dark.
- **The Widget** fills 100 % of its iframe without scrolling, opens the View with `host.openView()`, and re-reads storage when it becomes visible, since the View's changes are not pushed to it.
- **The View** adapts from 360 px wide to desktop width. Only a View may hand the User a download (a `download` link to a `blob:` URL, after a click).
- **Visibility**: stop timers and polling while hidden.
- **Updates** keep the storage (§8): a later version must read what earlier versions wrote.
- Reference every file with a relative URL (`style.css`, `../tessello-sdk.js`).

### 5. Write the User guide

`guide.md` is for the **User**, not a developer README (§3.2). Model it on https://github.com/craftskillz/tessello/blob/main/examples/notes/guide.md. Cover:

- what the Module is for, in a sentence or two;
- how to use the View and, if any, the Widget, naming the buttons as they appear;
- what each message the Module may show means, and what to do about it;
- where the data goes: which servers it contacts and why (its Permissions), and that uninstalling deletes it.

The Host shows it without running code: no raw HTML, images only from files of the package with a relative path.

### 6. Validate until green

Run the Validator on the folder, then fix and rerun until it ends with `✓ … this Module is installable.`, which means no error:

```sh
npx tessello validate pomodoro
```

Each issue names the file and its code (§9 lists them). Fix warnings too, unless one is a harmless mention the static scan flagged (a comment naming `localStorage`, say); tell the user which warnings remain and why. When you cannot run commands, give the user the command and work from the output they paste back, round after round.

### 7. Package as a `.zip`

Zip the folder's **contents**, so that `manifest.json` sits at the root of the archive, not inside a folder:

```sh
cd pomodoro && zip -r ../pomodoro-1.0.0.zip . -x '.*' && cd ..
npx tessello validate pomodoro-1.0.0.zip
```

The `.zip` must also validate with zero errors. Done: hand the user the `.zip` and how to try it: in the Host (https://tessello.pages.dev/, Chrome or Edge on a computer), **Install a Module…** with the `.zip`, or copy the folder into their Modules folder while developing, then reopen the View after each change.

## Publishing

Stop at the validated `.zip`; publishing is the Creator's call. When they ask about it, point them to:

- **Hosting**: the `.zip` must be served over `https:` with `Access-Control-Allow-Origin` (§8). GitHub Pages does this; publish one URL per version and never overwrite a published version. GitHub Release assets and "Download ZIP" do not work.
- **The Marketplace**: read and accept https://github.com/craftskillz/tessello-marketplace/blob/main/PUBLISHING.md, then run `npx tessello publish <package>.zip --url <its URL> --accept-terms`. The Module ID's namespace must be the publishing GitHub account.
