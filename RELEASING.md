# Releasing

Three things get released, each with its own command, in its own repository:

| What | Where | Command | Result |
|---|---|---|---|
| A version of a Module | the Module's repository, e.g. `tessello-watch-later` | `just publish minor` | Its `.zip` on GitHub Pages, at `https://craftskillz.github.io/tessello-<name>/<version>.zip`. |
| That version on the Marketplace | `tessello` | `just marketplace <name>` | A pull request on `craftskillz/tessello-marketplace` that lists it. |
| Tessello's npm packages (`tessello`, `@tessello/sdk`, `@tessello/convention`, `@tessello/marketplace`) | `tessello` | `just npm-publish` | The new versions on npm. |

"Publish" always means a Module: `just publish` lives in Module repositories, and the npm packages of Tessello itself have `just npm-publish`.

None of this needs the Host running. You need [just](https://github.com/casey/just), Node 24, and the [GitHub CLI](https://cli.github.com/) logged in (`gh auth login`) as an account that is a public member of the `craftskillz` organisation.

## A new version of a @craftskillz Module

1. In the Module's repository, on an up-to-date `main` with everything committed:

   ```sh
   just publish minor    # or major, patch, fix
   ```

   It installs the locked dependencies, checks types and tests, builds and validates the package, raises the version in `package.json`, `package-lock.json` and `manifest.json`, commits "Release <version>", tags `v<version>` and pushes. The Release workflow of the repository (GitHub, *Actions → Release*) then publishes `<version>.zip` on GitHub Pages. It refuses a version that is already published: a published version never changes.

2. Wait until that workflow is green (a minute or two), then in `tessello`:

   ```sh
   just marketplace watch-later    # the name of the Module, without @craftskillz/
   ```

   It downloads the published `.zip` (never a local build: the listing pins the SHA-256 of the published bytes), then runs `tessello publish`, which checks it as the Marketplace CI will and opens the pull request. A new version is merged automatically once the CI passes, and the Marketplace site is rebuilt a few minutes later.

3. Optionally, refresh the copy the Host's browser tests use: `just fixture watch-later <version>` in `tessello`, then commit it.

`just marketplace` with no name does all four Modules; `just marketplace --dry-run` checks without opening anything. A Module already listed at its published version is reported as "already listed" (and among the "Not done" at the end), and nothing is opened for it.

## A new @craftskillz Module

1. In `tessello`:

   ```sh
   just new-module pomodoro               # Svelte
   just new-module pomodoro typescript    # TypeScript, without a framework
   ```

   It creates the public repository `craftskillz/tessello-pomodoro` from [`tessello-template-svelte`](https://github.com/craftskillz/tessello-template-svelte) or [`tessello-template-typescript`](https://github.com/craftskillz/tessello-template-typescript), renames `my-module` everywhere, checks that it builds, tests and validates, turns on GitHub Pages, and clones it into `../tessello-pomodoro`. The template is a small working Module (a counter, with a View and a Widget) to replace with yours.

2. Write the Module there, then release its first version with `just publish minor` (it starts at 0.0.0, so this gives 0.1.0).

3. In `tessello`, `just marketplace pomodoro`. A new Module waits for the Maintainer's Approval: on the pull request in `craftskillz/tessello-marketplace`, add the label `approved`. The CI checks it again and merges it, and the Module is on https://tessello-marketplace.pages.dev/ a few minutes later.

## Tessello's npm packages

1. Raise `version` in the `package.json` of each package that changed (`packages/cli`, `packages/sdk`, `packages/convention`, `packages/marketplace`). A package that depends on another one names its exact version: raise that too.

2. In `tessello`, in your own terminal, logged in to npm as the owner of the packages (`npm login` as `craftskillz`; npm asks for your two-factor code):

   ```sh
   just npm-publish
   ```

   It builds the packages into `packages/<name>/dist/`, tests them compiled and installed from `npm pack`, then publishes on npm, in the order they depend on each other, each one whose version is not on npm yet. The others are reported as "already on npm".

3. Commit the raised versions and push.

## Another Creator

A Creator outside `craftskillz` publishes under the Namespace of their own GitHub account (`@jane/…`), with the same tools:

1. **Use this template** on `tessello-template-svelte` or `tessello-template-typescript`, then replace `my-module`, `My Module` and `craftskillz` with their own names (the template's README lists the files), create an empty `gh-pages` branch, and turn on GitHub Pages from it.
2. `just publish minor` in their repository, as above.
3. Once the Release workflow is green, from their repository:

   ```sh
   npx tessello publish <version>.zip --url https://<account>.github.io/<repository>/<version>.zip --accept-terms
   ```

   with the `.zip` downloaded from that URL. `--accept-terms` says they have read the Marketplace's [PUBLISHING.md](https://github.com/craftskillz/tessello-marketplace/blob/main/PUBLISHING.md) and accept it. With `gh` logged in, it forks the Marketplace and opens the pull request; without it, it writes the listing into `tessello-listing/` and says what to do by hand.

Their first Module waits for the Maintainer's `approved` label; their later versions are merged once the CI passes.
