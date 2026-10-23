# @tessello/marketplace

The format of a Marketplace listing, the Verifier the Marketplace CI runs on every pull request, and the Index Generator that builds `index.json` from the accepted listings. Isomorphic, like `@tessello/convention`: it runs in Node and in the browser, and never touches the network.

## The listing: `modules/<namespace>/<name>/entry.json`

Each Module of the Marketplace has a folder holding `entry.json` and, optionally, its screenshots. Everything else (name, description, icon, Permissions, Widgets, User guide) is read from the Manifest of the package: nothing is copied.

```json
{
  "id": "@craftskillz/diagram",
  "source": "https://github.com/craftskillz/tessello",
  "license": "MIT",
  "tags": ["diagrams", "drawing"],
  "screenshots": ["canvas.png"],
  "versions": [
    {
      "version": "1.0.0",
      "url": "https://craftskillz.github.io/tessello/diagram-1.0.0.zip",
      "sha256": "3f2a…64 lowercase hex characters…"
    }
  ]
}
```

| Field | Required | Value |
| --- | --- | --- |
| `id` | yes | The Module Identifier, `@namespace/name`. It matches the folder. |
| `source` | yes | `https://github.com/<owner>/<repo>`, a public repository. |
| `license` | yes | An OSI-approved SPDX identifier, the one GitHub reports for `source`. |
| `tags` | no | At most 10, each 1 to 32 lowercase letters, digits or hyphens. |
| `screenshots` | no | At most 3 file names of the listing folder, `.png` or `.webp`, 500 KB at most each. |
| `versions` | yes | At least one `{ version, url, sha256 }`, oldest first. |
| `withdrawn` | no | `true`: the Creator withdrew the Module (Withdrawal). |
| `banned` | no | A reason: the Maintainer banned the Module (Ban). |

A version has `version` (semver), `url` (the `.zip`, served over `https:` with CORS headers, one URL per version, never overwritten), `sha256` (of the `.zip`), and may carry `withdrawn: true` or `banned: "<reason>"`.

## `namespaces.json`

The Maintainer's record of the Namespaces already approved: namespace (without `@`) → `{ "account": "<GitHub login>", "id": <numeric GitHub id>, "state": "active" | "frozen" | "banned", "reason"?: "<why>" }`. A new Namespace is added at its first Approval.

## The Verifier

```ts
const verdict = await verifyEntry({ folder, entry, previous, packages, files, github, namespaces });
// verdict.ok, verdict.issues, verdict.change: "new-module" | "new-version" | "metadata" | "other" | null
```

The CI downloads each new version's package, reads the facts it needs from GitHub (the pull request's author, the account named like the Namespace and the author's public membership, the source repository's visibility and licence) and passes everything in. The Verifier reads packages as archives and never runs them.

The change type drives the merge: `new-module` awaits the Maintainer's Approval; `new-version` and `metadata` (tags or screenshots) merge automatically when `ok`; `other` goes to the Maintainer.

### Issue codes

Every issue is an error and has a stable code.

| Code | Meaning |
| --- | --- |
| `entry/invalid-json`, `entry/unknown-field`, `entry/missing-field`, `entry/invalid-type` | `entry.json` is not a well-formed listing. |
| `entry/invalid-id`, `entry/invalid-source`, `entry/invalid-license` | A required field has the wrong format. |
| `entry/invalid-tag`, `entry/too-many-tags`, `entry/duplicate-tag` | Tags break their rules. |
| `entry/invalid-screenshot`, `entry/too-many-screenshots`, `entry/duplicate-screenshot` | Screenshot names break their rules. |
| `entry/no-versions`, `entry/invalid-version`, `entry/invalid-url`, `entry/invalid-sha256`, `entry/duplicate-version` | A version is malformed. |
| `entry/invalid-withdrawn`, `entry/invalid-banned` | `withdrawn` is not `true`, or `banned` is not a reason. |
| `entry/folder-mismatch` | `id` does not match the listing folder. |
| `namespace/reserved` | `@tessello` is reserved. |
| `namespace/no-account` | No GitHub account has the Namespace's name. |
| `namespace/not-owner` | The author is not that account, nor a public member of that organisation. |
| `namespace/id-mismatch` | The account now holding the name is not the one recorded in `namespaces.json`. |
| `source/not-found`, `source/private` | The source repository is missing or private. |
| `license/not-osi`, `license/not-reported`, `license/mismatch` | The licence is not OSI-approved, GitHub reports none, or GitHub reports another one. |
| `version/published-removed`, `version/published-changed` | A published version was removed, or its `url` or `sha256` changed. |
| `version/not-greater` | A new version is not greater than every version before it. |
| `version/insecure-url` | A new version's URL is not `https:`. |
| `version/package-missing` | The CI could not download a new version's package. |
| `version/sha256-mismatch` | The package's SHA-256 is not the one listed. |
| `version/id-mismatch`, `version/version-mismatch` | The Manifest's `id` or `version` differs from the listing. |
| `screenshot/missing`, `screenshot/too-large`, `screenshot/invalid-image` | A listed screenshot is absent, over 500 KB, or not a PNG or WebP image. |
| Validator codes (`package/…`, `manifest/…`, …) | The Validator's errors on a new version's package, with their own codes (Convention §9). |

## The index: `index.json`

`index.json` and the assets must be served with `Access-Control-Allow-Origin: *`, since the Host fetches them from another origin (set up with the deployment).

`buildIndex({ listings, packages, generatedAt })` turns the accepted listings and the packages of the versions they describe (`"<id>@<version>"` → `.zip`) into `{ index, assets, issues }`. The CI writes `JSON.stringify(index)` as `index.json` and each entry of `assets` as a file next to it; the Host fetches both and reuses `searchModules`. It never throws: a problem is an `issue` and costs the Module its `latest`, or a screenshot.

```json
{
  "format": 1,
  "generatedAt": "2026-05-01T08:30:00.000Z",
  "modules": [
    {
      "id": "@craftskillz/diagram",
      "creator": "@craftskillz",
      "source": "https://github.com/craftskillz/tessello",
      "license": "MIT",
      "tags": ["diagrams"],
      "screenshots": ["modules/craftskillz/diagram/canvas.png"],
      "versions": [{ "version": "1.0.0", "url": "https://…/diagram-1.0.0.zip", "sha256": "3f2a…" }],
      "state": "listed",
      "latest": {
        "version": "1.0.0", "url": "https://…/diagram-1.0.0.zip", "sha256": "3f2a…",
        "name": "Diagram", "description": "Draw diagrams.",
        "icon": "modules/craftskillz/diagram/1.0.0/icon.svg",
        "convention": 1, "permissions": {}, "widget": { "size": "M" },
        "guide": {
          "path": "guide.md", "markdown": "# Diagram…",
          "images": { "docs/shot.png": "modules/craftskillz/diagram/1.0.0/docs/shot.png" }
        }
      }
    }
  ]
}
```

- `format` is `1`; a change that breaks readers bumps it. `generatedAt` is an ISO 8601 date. `modules` is sorted by `id`.
- Every listed, withdrawn or banned Module is in the index, so that Hosts that installed it know. `state` is `"banned"` (with `reason`) when the listing is banned (a Ban wins), `"withdrawn"` when the Creator withdrew it, `"listed"` otherwise. `versions` are copied as listed (oldest first) with their `withdrawn` and `banned` marks.
- `creator` is the namespace with its `@`. `tags` is `[]` when the listing has none.
- `latest` is what the package of the newest version that is neither withdrawn nor banned says of itself (`name`, `description`, `icon`, `convention`, `permissions` (`{}` when none), `widget` (`null` when none) and the `guide`). It is `null` when there is no such version, or when its package is missing (`index/package-missing`), is not the listed one (`index/sha256-mismatch`: never describe code that is not the listed one) or is not a valid Module (`index/invalid-package`). A banned or withdrawn Module keeps its `latest` as far as it can be computed.
- Asset paths are relative to `index.json`. The icon and the guide images found in the package (extensions of `GUIDE_IMAGE_EXTENSIONS`) are at `modules/<namespace>/<name>/<version>/<package path>`; `guide.images` maps a package path to its asset path, and `guide.path` is the `guide` argument of `renderGuide`. Screenshots are at `modules/<namespace>/<name>/<file>`; a listed screenshot absent from the folder is left out (`index/screenshot-missing`). The namespace is written without `@`.

### Search

`searchModules(modules, { query, accepts })` returns the Modules a User may find, in index order: listed ones with a `latest`, whose name, description, tags, creator or id contain every word of the query (case-insensitive, words split on whitespace; an empty query matches all). `accepts` is the Permission filter, the Permissions the User accepts: a Module matches when every Permission it declares (non-empty list) is accepted, so `[]` keeps the Modules with no Permission. Undefined accepts everything. Banned and withdrawn Modules, and Modules without `latest`, are never returned.

## The site

`renderSite(index, { hostUrl })` turns the index into the static site, as a map from site path to content, in English and with no third-party service, font or CDN:

- `index.html`: a card for each Module `searchModules` returns (so never a banned, withdrawn or version-less one), a search field, a Permission filter (`PERMISSION_FILTERS`: "Any Permissions", "No internet access", "No local network access", "No Permissions"; `permissionFilter(value)` gives the matching `accepts`; the labels are English, and the Host shows its own translated labels for the same `value`s), an empty-results message and the generation date. It works without JavaScript; `search.js` (bundled from `src/site/search.ts`) fetches `index.json` and hides the cards that `searchModules` does not return.
- `modules/<namespace>/<name>/index.html`, for every Module in the index. A listed Module with a `latest` shows its fiche, its screenshots, its rendered User guide, the ADR 0015 warning with a link to the source, and an "Install in Tessello" link to `<hostUrl>#install=<encoded package URL>`. A banned Module says so with the reason, a withdrawn one says "withdrawn by its Creator"; neither has an install link.
- `style.css`: light and dark (`prefers-color-scheme`), readable at phone width.

Every link and asset URL is relative (a Module page reaches the root with `../../../`), so the site can be served under a sub-path. Asset paths in the index are relative to the site root, where `index.json` lives. Each page has a `Content-Security-Policy` meta (`default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'`), so the pages have no inline style or script, and every value from a listing or a Manifest is escaped.

```
npm run build:marketplace -- --repo <marketplace checkout> --out <dir> --host https://tessello.app/ [--packages <dir>]
```

reads `modules/<namespace>/<name>/entry.json` and the files next to it, gets the package of the described version (`describedVersion`) from `<packages>/<namespace>/<name>/<version>.zip` when `--packages` is given, otherwise by downloading its URL, then empties `--out` and writes `index.json`, the assets, the pages and `search.js`. Problems (an unreadable listing, or what `buildIndex` reports) are printed as warnings and do not fail the build; `buildSite(options)` returns them.
