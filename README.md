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
| `sample-modules/` | Sample Modules built from sources, in Svelte (`diagram`, `skills-library`, `survival-kit`, `watch-later`): the package is written to `dist/`. |
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

### The sample Modules (`sample-modules/`)

A sample Module must be built before it is installed, and built again after each change to its sources: its `dist/` and its `.zip` are not versioned, and nothing rebuilds them on their own (the browser tests build their own copy elsewhere). With [just](https://github.com/casey/just), give the name of its folder:

```sh
just module skills-library            # one Module
just module skills-library diagram    # several, one after the other
just module skills-library minor      # raise the version first: major, minor, patch (or fix)
```

For each Module, this builds the package into `sample-modules/<name>/dist/`, replaces `sample-modules/<name>/<name>.zip` with a fresh one, and runs the Validator on it. Then drop the `.zip` onto the Host, or copy `dist/` into your Modules folder. With `major`, `minor`, `patch` or `fix` (the same as `patch`) anywhere among the names, the version of each Module named is raised first, in its `package.json`, its `manifest.json` and `package-lock.json`; without it, the version does not change. Commit these files with the change.

**After a change to its sources**: run `just module <name>` again, then either drop the `.zip` again (an update, data kept), or copy `dist/` again over the folder in your Modules folder and come back to the Host window. The Host treats any package of an installed Module as an update, whatever its version, and shows both versions: raise it to tell them apart.

### The Survival Kit (`sample-modules/survival-kit`)

Build it with `just module survival-kit`.

Its User guide (ⓘ, then **User guide**) explains everything, with screenshots; its source is `sample-modules/survival-kit/guide/guide.md`. To try it: open **Survival Kit** from the Launcher (tasks, notes, links, **Import a kit** for a `.survival-kit.json` of living-documentation); click **Tessello** to see its L Widget on the Home, where you can check an urgent task, open the View filtered on Urgent from the "N urgent" count, or click "open kit".

## Check a Module

```sh
node packages/cli/src/cli.ts validate examples/notes
node packages/cli/src/cli.ts validate sample-modules/survival-kit/dist
node packages/cli/src/cli.ts validate path/to/module.zip
```

A Module is installable when the Validator reports no error; the examples and samples must also have no warning.

## Tests

```sh
npm test              # unit tests of every package and sample Module, and the Validator on the examples and built samples
npm run typecheck     # TypeScript, without emitting anything
npm run test:browser  # builds the Host, then drives it in Chromium (Playwright): install, Home, Widgets, Survival Kit…
```

The browser tests build the sample Modules themselves, in a temporary folder. The first time, Playwright may need its browser: `npx playwright install chromium`.

## Other commands

```sh
npm run build:host     # builds the Host into packages/host/dist/
npm run build:sdk      # writes the SDK's single-file copy (tessello-sdk.js) into the example Modules
npm run build:samples  # builds every sample Module into its dist/, without zipping (see `just module`)
```

## The npm packages

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
