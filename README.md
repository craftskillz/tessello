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
| `examples/` | Example Modules written by hand (`notes`, `meteo`, `prometheus`): the folder *is* the package. |
| `sample-modules/` | Sample Modules built from sources (`survival-kit`, in Svelte): the package is written to `dist/`. |
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

### The Survival Kit (`sample-modules/survival-kit`)

Build it first; the package is written to `sample-modules/survival-kit/dist/` (not versioned):

```sh
npm run build -w @tessello/survival-kit
cd sample-modules/survival-kit/dist && zip -r ../survival-kit.zip . && cd -
```

Then drop `sample-modules/survival-kit/survival-kit.zip` onto the Host, or copy `dist/` into your Modules folder.

Its User guide (ⓘ, then **User guide**) explains everything, with screenshots; its source is `sample-modules/survival-kit/guide/guide.md`. To try it: open **Survival Kit** from the Launcher (tasks, notes, links, **Import a kit** for a `.survival-kit.json` of living-documentation); click **Tessello** to see its L Widget on the Home, where you can check an urgent task, open the View filtered on Urgent from the "N urgent" count, or click "open kit".

**After a change to its sources**: build again, then either zip and drop it again (an update, data kept), or copy `dist/` again over the folder in your Modules folder and come back to the Host window.

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
npm run build:samples  # builds every sample Module into its dist/
```
