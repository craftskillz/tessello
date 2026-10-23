# @tessello/marketplace

The format of a Marketplace listing and the Verifier the Marketplace CI runs on every pull request. Isomorphic, like `@tessello/convention`: it runs in Node and in the browser, and never touches the network.

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
