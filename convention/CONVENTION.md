# Tessello Module Convention — version 1

> Status: **draft**. This document is the normative contract between a Tessello **Host** and a **Module**. It is written for human Creators and for LLMs generating Modules.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## 1. Overview

A **Module** is an installable unit of a Tessello **Host**. Every Module provides one **View** (a full-screen presentation) and MAY provide one **Widget** (a compact presentation shown on the Host's **Home**).

Each View and each Widget runs in its own sandboxed `<iframe>`. A Module never touches the Host directly: it only exchanges messages with it, using the protocol defined in this document. Anything a Module needs from the Host (storage, theme, navigation, lifecycle) goes through these messages.

```
┌──────────────────────── Host ────────────────────────┐
│  Launcher │  ┌──────────── sandboxed iframe ───────┐  │
│           │  │  Module View (view/index.html)       │  │
│           │  │        ▲                             │  │
│           │  │        │ postMessage (this protocol) │  │
│           │  └────────┼─────────────────────────────┘  │
│           │           ▼                                │
│           │   Host: storage · theme · navigation       │
└──────────────────────────────────────────────────────┘
```

## 2. Package

A Module is a directory with a `manifest.json` file at its root:

```
weather/
├── manifest.json
├── icon.svg
├── view/
│   ├── index.html
│   └── app.js
└── widget/
    └── index.html
```

- The package MUST contain `manifest.json` at its root.
- To be installed from a file or a URL, the package MUST be distributed as a single `.zip` archive whose root contains `manifest.json` (not a nested folder).
- The uncompressed package MUST NOT exceed **10 MB**.
- All paths in the package MUST be relative, use `/` as separator, and MUST NOT contain `..` or start with `/`.
- Entry pages MUST reference their resources (scripts, styles, images) with **relative URLs**. A Module MAY also load resources from absolute `https://` URLs, provided their origin is declared in its network Permissions (§3.1).

## 3. Manifest

`manifest.json` is the Module's identity card. The Host and the Validator read it **without running the Module**.

```json
{
  "convention": 1,
  "id": "@yassine/weather",
  "name": "Weather",
  "version": "1.0.0",
  "description": "Current weather and 3-day forecast for your cities.",
  "icon": "icon.svg",
  "view": {
    "entry": "view/index.html"
  },
  "widget": {
    "entry": "widget/index.html",
    "size": "M"
  },
  "permissions": {
    "network": ["https://api.open-meteo.com"]
  }
}
```

| Field | Required | Rule |
|---|---|---|
| `convention` | yes | Integer. The version of this Convention the Module follows. MUST be `1`. |
| `id` | yes | The Module ID: `@namespace/name`. Both parts: lowercase letters, digits and `-`, starting with a letter or digit. Namespace ≤ 39 chars, name ≤ 64 chars. Regex: `^@[a-z0-9][a-z0-9-]{0,38}/[a-z0-9][a-z0-9-]{0,63}$`. |
| `name` | yes | Display name, 1–40 characters. |
| `version` | yes | [Semantic version](https://semver.org) `MAJOR.MINOR.PATCH` (pre-release suffix allowed, e.g. `1.0.0-beta.1`). |
| `description` | no | Plain text, ≤ 200 characters. |
| `icon` | yes | Path to a square `.svg` or `.png` file (PNG: at least 256×256 px). Shown in the Launcher. |
| `view.entry` | yes | Path to the View's HTML entry page. |
| `widget` | no | Present only if the Module provides a Widget. |
| `widget.entry` | if `widget` | Path to the Widget's HTML entry page. |
| `widget.size` | if `widget` | One of `"S"`, `"M"`, `"L"` (see §7.1). |
| `permissions` | no | The Module's Permissions (§3.1). Absent means no Permission at all. |

Rules:

- Every path in the Manifest MUST point to a file that exists in the package.
- The `id` MUST stay the same across all versions of a Module. **Changing the `id` creates a different Module**: the Host will not treat it as an update, and the data stored by the old Module is not carried over.
- A Host MUST ignore unknown top-level fields (they may be added by future minor revisions of this Convention). The Validator reports them as warnings.

### 3.1 Permissions

A **Permission** is an access a Module needs beyond its own package and the Host API. Every Permission MUST be declared in `permissions`; the Host shows them to the User **before** activating the Module and **blocks everything that is not declared**. A Module without `permissions` cannot reach the network at all.

```json
"permissions": {
  "network": ["https://api.datadoghq.com", "https://*.grafana.net", "wss://stream.example.com"],
  "localNetwork": ["http://localhost:9090", "http://192.168.1.20:3000"]
}
```

| Permission | Grants | Entries |
|---|---|---|
| `network` | Requests (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`) **and** remote resources (scripts, styles, images, fonts, media) from these public origins. | `https://` or `wss://` origins. The host MAY start with `*.` to match every subdomain (`*.grafana.net` matches `eu.grafana.net`, not `grafana.net`). Loopback and private addresses are not allowed here. |
| `localNetwork` | The same, towards the User's machine or local network. **Sensitive**: highlighted to the User. | `http://`, `https://`, `ws://` or `wss://` origins whose host is `localhost`, a loopback address (`127.0.0.1`, `[::1]`), a private IPv4 address (`10.x`, `172.16–31.x`, `192.168.x`) or a `.local` name. No wildcard. |

Rules for every entry:

- An entry is an **origin**: scheme, host and optional port, with no path, query or trailing `/`. Without a port, only the scheme's default port is allowed.
- An `https://` entry also allows `wss://` on the same host and port; an `http://` entry also allows `ws://`.
- Unknown Permission names are an error: a Host cannot grant what it does not know.

Browsers still apply their own rules on top of the Permissions: an API MUST accept cross-origin requests (CORS) from origin `null`, and a browser MAY ask the User before letting a page reach the local network. A future, optional **Bridge** (a local program run by the User) will lift these limits and add further Permissions, such as running declared commands; it is not part of Convention 1.

## 4. Runtime environment

Each View and Widget is loaded in an `<iframe>` with the `sandbox` attribute. A Module runs in an **opaque origin** (its origin is `"null"`).

A Module CAN rely on:

- running JavaScript, including ES modules and Web Workers;
- HTML forms;
- opening links in a new tab (`<a href="https://…" target="_blank">`);
- network requests (`fetch`, `XMLHttpRequest`, WebSocket, `EventSource`) and remote resources (scripts, styles, images, fonts, media) from the origins declared in its Permissions (§3.1), subject to each endpoint's CORS policy.

A Module MUST NOT rely on:

- `localStorage`, `sessionStorage`, IndexedDB or cookies — they are unavailable in an opaque origin. Use the Host storage (§6.1);
- accessing or navigating the parent window (`window.top`, `window.parent.document`, …);
- embedding frames (`<iframe>`, `<frame>`, `<object>`, `<embed>`), even from an origin declared in its Permissions: the Host blocks them;
- navigating its own iframe to another URL, including another page of its package: each View and each Widget is a single page, so a Module navigates within that page by changing `location.hash` (hash-based routing);
- changing the page URL with `history.pushState` or `history.replaceState`: passing a URL, even a fragment, throws a `SecurityError` in an opaque origin, so history-based routers do not work;
- `alert`, `confirm`, `prompt`;
- credentials-based requests (cookies sent to third-party APIs): requests come from origin `null`;
- any network access to an origin not declared in its Permissions: the Host blocks it.

The Host MAY unload a View or Widget at any time (for instance when the User navigates away). A Module MUST persist anything it wants to keep through the Host storage as soon as it changes, and MUST NOT expect a warning before being unloaded.

## 5. Message protocol

Host and Module communicate exclusively with `window.postMessage`. Every message is a plain JSON-serializable object with this envelope:

```json
{ "tessello": 1, "type": "storage.get", "id": "42", "payload": { "key": "cities" } }
```

| Field | Rule |
|---|---|
| `tessello` | MUST be `1` (the protocol version, equal to the Convention version). |
| `type` | The message type, e.g. `"storage.get"`. |
| `id` | Present on **requests** and **responses** only. A string chosen by the requester, unique among its pending requests. |
| `payload` | Optional object. Its content depends on `type`. |

### 5.1 Requests and responses

A **request** is sent by the Module to the Host and expects exactly one **response**:

```json
// Module → Host
{ "tessello": 1, "type": "storage.get", "id": "42", "payload": { "key": "cities" } }

// Host → Module, success
{ "tessello": 1, "type": "response", "id": "42", "ok": true, "result": { "value": ["Paris"] } }

// Host → Module, failure
{ "tessello": 1, "type": "response", "id": "42", "ok": false,
  "error": { "code": "invalid_payload", "message": "key must be a string" } }
```

Error codes:

| Code | Meaning |
|---|---|
| `unknown_type` | The Host does not know this request type. |
| `invalid_payload` | The payload does not match this specification. |
| `not_allowed` | The request is valid but not permitted in this context (e.g. `navigation.openView` sent from a View). |
| `quota_exceeded` | A storage limit would be exceeded (§6.1). |
| `not_ready` | A request was sent before the handshake completed (§6.4). |
| `internal` | Unexpected Host failure. |

### 5.2 Events

An **event** is sent by the Host to the Module, has no `id` and expects no response:

```json
{ "tessello": 1, "type": "visibility", "payload": { "visible": false } }
```

### 5.3 Rules for both sides

- A Module MUST only send messages to `window.parent`, with target origin `"*"` (the Host cannot be addressed by origin from an opaque origin).
- A Module MUST ignore messages whose `event.source` is not `window.parent`, and messages without `tessello: 1`.
- A Module MUST ignore events of unknown `type` (future versions may add events).
- The Host MUST only accept messages whose `event.source` is the iframe it created for that View or Widget, and answers unknown request types with `unknown_type`.

## 6. Capabilities

### 6.1 Storage

Each Module has a private key/value space, **shared by its View and its Widget** and invisible to other Modules. It is kept across updates of the Module and deleted when the Module is uninstalled. It is included in the Host's export.

| Request | Payload | Result |
|---|---|---|
| `storage.get` | `{ "key": string }` | `{ "value": any \| null }` — `null` if the key does not exist |
| `storage.set` | `{ "key": string, "value": any }` | `{}` |
| `storage.delete` | `{ "key": string }` | `{}` — succeeds even if the key does not exist |
| `storage.keys` | `{}` | `{ "keys": string[] }` |

Limits:

- `key`: 1–256 characters.
- `value`: any JSON value except `null`, at most **1 MB** once serialized (UTF-8 bytes of its JSON text). To remove a key, use `storage.delete`.
- Total size of a Module's storage: at most **5 MB**, counted as the sum, over all its keys, of the UTF-8 bytes of the key and of its serialized value. A `storage.set` that would exceed it fails with `quota_exceeded` and changes nothing.

When the View and the Widget are both alive, a change made by one is **not** pushed to the other. A Widget SHOULD re-read the values it displays when it becomes visible (§6.4).

### 6.2 Theme

The Host shares its visual theme so Modules blend in. The theme is delivered in the handshake result (§6.4) and again with a `theme.changed` event whenever it changes.

```json
{
  "mode": "dark",
  "colors": {
    "background": "#14161a",
    "surface": "#1d2026",
    "text": "#e8e9eb",
    "textMuted": "#9aa0a8",
    "accent": "#4f8cff",
    "border": "#2c3038"
  }
}
```

| Event | Payload |
|---|---|
| `theme.changed` | the theme object above |

- `mode` is `"light"` or `"dark"`. Every color is a `#rrggbb` string.
- A Module SHOULD follow the theme (at least `mode`, `background` and `text`). It MAY use its own palette, but MUST stay readable in both modes.

### 6.3 Navigation

A Widget can ask the Host to open its own Module's View, optionally passing parameters:

| Request | Payload | Result |
|---|---|---|
| `navigation.openView` | `{ "params"?: { [name: string]: string } }` | `{}` |

- Only a Widget MAY send `navigation.openView`; from a View it fails with `not_allowed`.
- `params` is a flat object of strings, at most **2 KB** once serialized.
- The View receives the params in its handshake result. If the View is already loaded when it is opened again, it receives a `navigation.params` event instead:

| Event | Payload |
|---|---|
| `navigation.params` | `{ "params": { [name: string]: string } }` |

A Module cannot open another Module.

### 6.4 Lifecycle

**Handshake.** When its page has loaded and it is ready to receive events, the View or Widget MUST send the `ready` request. Until the Host has answered it, the Host sends no event, and any other request fails with `not_ready`.

| Request | Payload | Result |
|---|---|---|
| `ready` | `{}` | the context object below |

```json
{
  "surface": "widget",
  "module": { "id": "@yassine/weather", "version": "1.0.0" },
  "locale": "fr-FR",
  "theme": { "mode": "dark", "colors": { "...": "..." } },
  "params": {}
}
```

- `surface` is `"view"` or `"widget"`.
- `locale` is a [BCP 47](https://www.rfc-editor.org/info/bcp47) tag giving the Host's interface language. A Module MAY use it to localize itself.
- `params` is present only when `surface` is `"view"` (§6.3); it is `{}` when the View was opened from the Launcher.
- If `ready` is not received within **10 seconds** after the iframe has loaded, the Host MAY show an error in place of the View or Widget.

**Visibility.** The Host tells the Module when it is shown or hidden (for instance a View left in the background, or the Home hidden behind a View):

| Event | Payload |
|---|---|
| `visibility` | `{ "visible": boolean }` |

A Module starts **visible** after the handshake. A hidden Module SHOULD stop timers, animations and polling until it becomes visible again.

## 7. Presentation

### 7.1 Widget sizes

The Home is a grid of square cells. `widget.size` sets how many cells a Widget occupies:

| Size | Cells (columns × rows) | Indicative size |
|---|---|---|
| `S` | 1 × 1 | 160 × 160 px |
| `M` | 2 × 1 | 336 × 160 px |
| `L` | 2 × 2 | 336 × 336 px |

The real size of a cell varies with the screen. A Widget MUST fill its iframe (`100%` width and height) and adapt to it, and SHOULD NOT scroll. A Widget is a preview and an entry point: it SHOULD offer a way to open the View (`navigation.openView`).

### 7.2 View

A View fills the Host's main area, outside the Launcher. It MUST adapt to its iframe size, from phone width (360 px) to desktop width.

## 8. Installation, update and uninstall

These Host behaviors are listed here because Creators must take them into account.

- **Install**: from a `.zip` file, from a URL pointing to a `.zip` file, or with the CLI (`npx tessello install <path-or-url>`). The Host runs the Validator first and refuses a non-compliant Module. It then lists the Module's Permissions in plain language, sensitive ones highlighted, and installs the Module only if the User accepts **all** of them; there is no partial grant.
- **Update**: installing a package whose `id` is already installed replaces the installed Module and **keeps its storage**. A Module MUST therefore read the data written by its previous versions (or migrate it). If the new version declares Permissions the installed one did not have, the Host shows only the added ones and asks the User again; if the User declines, the update is cancelled and the installed version stays in place.
- **Same `id`, different Creator**: the Host cannot tell an update from an unrelated Module that reuses an `id`. It always treats a known `id` as an update, and before replacing anything it shows the User the installed and incoming name and version, and asks for confirmation. Creators MUST therefore name their Modules under their own namespace.
- **Uninstall**: removes the Module **and** its storage, after the User confirms. Uninstalling is the only way to withdraw a Permission.

## 9. Validation

The Validator checks a package against this Convention. It runs when the Creator calls `npx tessello validate <path>`, when the Host installs a Module, and when the marketplace receives one. A package is installable only if the Validator reports **no error**.

Every issue has a stable code, shown in brackets in the Validator's output.

Errors:

1. The archive is not a readable `.zip` (`package/invalid-zip`).
2. The package exceeds 10 MB uncompressed (`package/too-large`).
3. A file of the package has an absolute path or a path containing `..` (`package/unsafe-path`).
4. `manifest.json` is missing at the package root (`manifest/missing`), or is not a valid JSON object (`manifest/invalid-json`).
5. A required Manifest field is missing (`manifest/field-required`) or has the wrong type (`manifest/invalid-type`).
6. A Manifest field has an invalid value (`manifest/invalid-convention`, `manifest/invalid-id`, `manifest/invalid-name`, `manifest/invalid-version`, `manifest/invalid-description`, `manifest/invalid-widget-size`).
7. `convention` is not a version supported by the Validator (`manifest/unsupported-convention`).
8. A path in the Manifest is absolute or contains `..` (`manifest/unsafe-path`), points to a missing file (`manifest/file-not-found`), or an entry is not an `.html` page (`manifest/entry-not-html`).
9. The icon is not `.svg` or `.png` (`icon/invalid-format`), or a PNG icon is unreadable (`icon/invalid-png`), not square (`icon/not-square`) or smaller than 256×256 px (`icon/too-small`).
10. `permissions` is not an object, a Permission is not an array of strings, or an entry is not a valid origin for its Permission (`permissions/invalid`).
11. `permissions` contains an unknown Permission (`permissions/unknown`).

Warnings (the package stays installable):

1. Unknown top-level Manifest field (`manifest/unknown-field`).
2. An HTML page references a resource with an absolute local path (`/app.js`) instead of a relative one (`source/absolute-path`).
3. An HTML page or script uses an API unavailable in the sandbox: `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `window.top`, `alert`, `confirm`, `prompt`, or embeds a frame (`<iframe>`, `<frame>`, `<object>`, `<embed>`) (`sandbox/unavailable-api`).
4. No source appears to send the `ready` request (`lifecycle/no-ready`).
5. A source loads or calls an absolute URL whose origin is not covered by the Permissions; the Host will block it (`permissions/undeclared-origin`).

Warnings come from a static scan of `.html`, `.htm`, `.js` and `.mjs` files and are best effort: they can miss a problem in minified code, or flag a harmless mention.

macOS archive metadata (`__MACOSX/`, `.DS_Store`) is ignored, both in archives and in folders.

## 10. SDK (non-normative)

The official SDK wraps this protocol; using it is optional. A Module that follows §5 and §6 by hand is equally valid.

```js
import { connect } from "@tessello/sdk";

const host = await connect();          // sends `ready`, returns the context
host.context.surface;                  // "view" | "widget"
await host.storage.set("cities", ["Paris"]);
const cities = await host.storage.get("cities");
host.onThemeChange((theme) => applyTheme(theme));
host.onVisibilityChange((visible) => (visible ? resume() : pause()));
await host.openView({ city: "Paris" }); // Widget only
```

## 11. Limits

All numeric limits of this Convention, in one place:

| Limit | Value | Section |
|---|---|---|
| Uncompressed package size | 10 MB | §2 |
| Storage value size (serialized) | 1 MB | §6.1 |
| Total storage per Module | 5 MB | §6.1 |
| Storage key length | 256 characters | §6.1 |
| `navigation.openView` params (serialized) | 2 KB | §6.3 |
| Handshake timeout | 10 s | §6.4 |

These limits are deliberately conservative. They MAY be **raised** in a minor revision; they are never lowered within a Convention version (§12).

## 12. Versioning of this Convention

- Adding optional Manifest fields, request types, event types or Permissions, or **raising a limit** (§11), is a **minor revision**: it keeps `convention: 1`, and existing Modules keep working (Modules ignore unknown events, Hosts ignore unknown Manifest fields).
- Any change that could break an existing Module (removing or renaming a field, a message type or a capability, tightening a limit) requires a new Convention version (`convention: 2`). A Host states which Convention versions it supports and refuses the others with a clear message.
