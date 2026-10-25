# Tessello

A composable web app: the User builds their space from Modules, each one a sandboxed View and an optional Widget on the Home. The contract between the Host and a Module is the [Convention](convention/CONVENTION.md); the vocabulary is in [GLOSSARY.md](GLOSSARY.md), the decisions in [docs/adr/](docs/adr/).

## Repository layout

| Path | What it is |
|---|---|
| `convention/CONVENTION.md` | The Convention: the public contract a Module follows. |
| `packages/convention` | The Validator and the Convention's limits, used by the CLI and the Host. |
| `packages/cli` | The `tessello` CLI (`tessello validate <folder or .zip>`). |
| `packages/sdk` | `@tessello/sdk`: talks to the Host from a Module. |
| `packages/host-core` | The Host's protocol, storage and Module registry, without a browser. |
| `packages/host` | The Host: the static web app (`src/`), its build and dev server (`scripts/`), its browser tests (`e2e/`). |
| `scripts/` | The build of the npm packages (`build-packages.ts`) and the hook that tests them compiled (`use-compiled.ts`). |
| `examples/` | Example Modules written by hand (`notes`, `meteo`, `prometheus`): the folder *is* the package. |
| `RELEASING.md` | How to release a Module, list it on the Marketplace, and publish the npm packages. |
| `DEPLOYING.md` | How the Host is deployed to Cloudflare Pages as an installable app, with its headers and free quotas. |
| `.scratch/` | Spec and tickets (see `docs/agents/issue-tracker.md`). |

## Prerequisites

- Node.js 24 or later (the TypeScript sources run directly with `node`).
- Chrome or Edge on a computer: the Host keeps Modules in a folder of your machine, which only these browsers let a page use.

```sh
npm install
```

## Run the Host locally

```sh
npm run start:host          # builds the Host, then serves it on http://127.0.0.1:8080/
PORT=3000 npm run start:host  # on another port
```

On the first launch, click **Choose a folder…** and pick an empty folder: it becomes your **Modules folder**, where the Host keeps your Modules and, under `.tessello/`, their data.

## Install a Module in the Host

A package must have `manifest.json` at its root. Two ways to install it:

- **From a `.zip`**: zip the *contents* of the package folder (not the folder itself), then drop the `.zip` onto the Host or use **Install a Module…**, and accept.
- **As a folder**: copy the package folder into your Modules folder (any folder name; a copy, not a symlink), then come back to the Host window: it rescans the folder when it gets the focus and offers to install the Module.

Installing a package whose `id` is already installed is an update: the Module's data is kept.

Every Module comes with a **User guide**, a Markdown file named by `guide` in its Manifest (Convention §3.2). Click **ⓘ** next to a Module in the Launcher, then **User guide**, to read it.

To move your space to another browser or computer, click **Modules folder** in the Launcher, then **Export your space**: a single `.zip` holds your Modules, their data, the Permissions you granted and the layout of the Home. **Import a space…** in the other Host shows the Modules and their Permissions before activating them. Importing merges: a Module already installed is left as it is, with its own data (ADR 0011).

### An example Module (`examples/`)

The folder is the package:

```sh
cd examples/notes && zip -r ../../notes.zip . && cd -
```

**Local Prometheus** (`examples/prometheus`) shows the state of a Prometheus running at `http://localhost:9090` (`prometheus --config.file=prometheus.yml`; its default CORS setting accepts Tessello). Served from `127.0.0.1`, the Host is itself local, so the browser does not ask before reaching the local network; deployed, Chrome and Edge ask once (Convention §3.1, ADR 0012).

### The Modules of @craftskillz

Four larger Modules, written in Svelte, each live in their own repository, which builds, tests and publishes its `.zip` on GitHub Pages (`https://craftskillz.github.io/tessello-<name>/<version>.zip`):

- [`tessello-diagram`](https://github.com/craftskillz/tessello-diagram)
- [`tessello-watch-later`](https://github.com/craftskillz/tessello-watch-later)
- [`tessello-survival-kit`](https://github.com/craftskillz/tessello-survival-kit)
- [`tessello-skills-library`](https://github.com/craftskillz/tessello-skills-library)

Here, their published packages are kept in `packages/host/e2e/fixtures/`: the browser tests of the Host run on them, and the Validator is run on each one. See the `README.md` there to refresh one (`just fixture <name> <version>`).

To release a version of one of them and list it on the Marketplace, or start a new Module from a template: see [RELEASING.md](RELEASING.md) (`just publish minor` in the Module's repository; `just new-module <name>` here).

## Check a Module

```sh
node packages/cli/src/cli.ts validate examples/notes
node packages/cli/src/cli.ts validate packages/host/e2e/fixtures/survival-kit.zip
node packages/cli/src/cli.ts validate path/to/module.zip
```

A Module is installable when the Validator reports no error; the examples and the published Modules must also have no warning.

## Tests

```sh
npm test                   # unit tests of every package, and the Validator on the examples and the published Modules
npm run typecheck          # TypeScript, without emitting anything
npm run test:browser       # builds the Host, then drives it in Chromium (Playwright): install, Home, Widgets, Survival Kit…
npm run test:browser:host  # a short set of the Host's browser tests, those a deployment waits for (just e2e-host)
```

What blocks a deployment of the Host, and where every browser test runs: see [DEPLOYING.md](DEPLOYING.md#how-it-deploys).

The browser tests install the four @craftskillz Modules from their packages in `packages/host/e2e/fixtures/`. The first time, Playwright may need its browser: `npx playwright install chromium`.

## Other commands

```sh
npm run build:host     # builds the Host into packages/host/dist/
npm run build:sdk      # writes the SDK's single-file copy (tessello-sdk.js) into the example Modules
```

## The npm packages

`just npm-publish` builds them, tests them compiled and installed from `npm pack`, then publishes on npm each one whose version is not there yet, in the order they depend on each other. Raise the version in its `package.json` first; npm asks for your two-factor code. See [RELEASING.md](RELEASING.md).

Four packages go to npm: `tessello` (the CLI, `packages/cli`), `@tessello/sdk`, `@tessello/convention` (the Validator) and `@tessello/marketplace`. In this repository they run from their TypeScript sources; for npm, each one is compiled into its own `dist/`, which *is* the package: JavaScript, type declarations (not for the CLI), a `package.json` pointing at them, its README and the license. `@tessello/sdk` also holds `tessello-sdk.js`, the single file a Creator copies into a Module.

```sh
npm run build:packages  # compiles the four packages into packages/<name>/dist/
npm run test:compiled   # builds them, then runs the unit tests against dist/ instead of the sources
npm run test:packed     # builds them, packs them with npm and installs them in a temporary folder, then runs `tessello validate` there
```

They need Node.js 22.12 or later. To publish, with the Maintainer's npm account, a member of the `tessello` organization on npm (which owns the `@tessello` scope): raise the `version` in `packages/<name>/package.json` (and in the `dependencies` that name it), run the three commands above, then publish each `dist/`, the packages before those that depend on them:

```sh
npm publish --access public packages/sdk/dist
npm publish --access public packages/convention/dist
npm publish --access public packages/marketplace/dist
npm publish --access public packages/cli/dist
```

Never publish from `packages/<name>/` itself: its `package.json` points at the TypeScript sources.

## Moving data to the `@craftskillz` Module IDs

The Modules of this repository were renamed from `@tessello/…` (and `@craftskills/watch-later`) to `@craftskillz/…`. A Module's data is tied to its Module ID, so a Modules folder used before the rename still keeps it under the old IDs. With the Host closed, a one-off script moves the registry entries, the data, the Home and the Manifests of the installed Modules:

```sh
node packages/host/scripts/rename-to-craftskillz.ts <Modules folder>          # dry run: lists what it would change
node packages/host/scripts/rename-to-craftskillz.ts <Modules folder> --apply  # makes the changes
```

Before changing anything, it copies `.tessello/` and the Manifests it rewrites into a hidden `.tessello-backup-<date>-<time>/` folder of the Modules folder. To go back, close the Host and copy the backup's contents over the Modules folder. If a new Module ID is already in use (registered, holding data or declared by a folder), it changes nothing and names it. Given an export of the Space (`.zip`) instead of a folder, it writes a renamed copy next to it, `<name>-craftskillz.zip`, to import into an empty Space.

## License

Tessello is released under the [MIT License](LICENSE): you may use, copy, modify and distribute it, in your own Modules too, as long as you keep the copyright notice.

The agent skills in `.agents/skills/` (linked from `.claude/skills/`) come from [mattpocock/skills](https://github.com/mattpocock/skills), © Matt Pocock, under its own [MIT License](.agents/skills/LICENSE); `skills-lock.json` records their source.
