# Deploying the Host

The Host is a static site on the Cloudflare Pages project `tessello`, served at https://tessello.pages.dev/. It has no backend, no Worker and no Pages Function: Modules and their data stay in each User's Modules folder (ADR 0002, ADR 0007).

## What gets deployed

`npm run build:host` writes `packages/host/dist/`:

| File | Role |
|---|---|
| `index.html`, `main.js`, `style.css` | The Host. |
| `manifest.webmanifest`, `icon.svg` | Make the Host installable as an app (PWA) in Chrome and Edge. |
| `sw.js` | The service worker: keeps the files above, so the installed Host opens offline with the Modules already installed. It only answers for the Host's own files, never for a Module, the Marketplace or a package download. |
| `_headers` | The HTTP headers Cloudflare Pages adds, written from `packages/host/scripts/headers.ts`. |

The headers, and why:

- `Content-Security-Policy: frame-src 'none'` on every path: a Module cannot navigate its iframe away (ADR 0005). It is the Host's only CSP directive. A `srcdoc` document inherits the Host's CSP, so the Host restricts nothing else that Modules load. If the Host ever gets a `connect-src`, it must allow `https:`, `http://localhost:*` and `http://127.0.0.1:*`, or installing by URL fails silently (ADR 0009).
- `Cache-Control: no-cache` on `/sw.js`: the browser checks for a new service worker on every visit, so a deployment reaches installed Hosts. The build names the cache after a hash of the shell's files, so a deployment that changes one changes `sw.js`. The new worker caches the new files and deletes the old ones. A Host that is already open keeps its version until it is next loaded.

`npm run start:host` and the browser tests (`npm run test:browser`) serve `dist/` with the same headers from the same file. A local run is a faithful copy of the deployed Host.

## How it deploys

At each push to `main`, the workflow *Deploy the Host* (`.github/workflows/deploy-host.yml`) runs:

1. Type checks, unit tests, the Host build and every browser test against it.
2. Only if they pass, in a separate job, `wrangler pages deploy` of `dist/` to the project `tessello`.

The deploy job needs the repository variable `CLOUDFLARE_ACCOUNT_ID` and the secret `CLOUDFLARE_API_TOKEN`, an account token with the single permission *Cloudflare Pages: Edit* (the same kind as the Marketplace's). Without the variable, the job is skipped and the build stays an artifact of the run. To deploy again by hand, use *Actions → Deploy the Host → Run workflow*.

## Setting it up, once (the Maintainer)

These steps create things at Cloudflare and on GitHub. Only the Maintainer does them.

1. In the Cloudflare account that already hosts `tessello-marketplace`, create a Pages project `tessello` (*Workers & Pages → Create → Pages → Direct Upload*). If `tessello.pages.dev` is taken, pick another name, then change `--project-name` in the workflow and the Marketplace's `TESSELLO_HOST` variable.
2. Give the existing token access to it, or create one with *Cloudflare Pages: Edit*.
3. In `craftskillz/tessello`, *Settings → Secrets and variables → Actions*: add the secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`.
4. Run *Deploy the Host*, then check:

   ```sh
   curl -sI https://tessello.pages.dev/ | grep -i content-security-policy    # frame-src 'none'
   curl -sI https://tessello.pages.dev/sw.js | grep -i cache-control         # no-cache
   ```

   Then open the address in Chrome and install the app (the install icon in the address bar).

The address `https://tessello.pages.dev/` is the one the Marketplace's "Install in Tessello" links open. Every installed Host and every User's settings belong to this origin. Never rename or delete the project.

## Free quotas

All of it fits the free plans, and none of them bills for usage beyond the quota:

- **Cloudflare Pages Free**: 500 deployments a month (one per push to `main`), 20,000 files per site, 25 MiB per file, 100 `_headers` rules. Static requests and bandwidth are unlimited (ADR 0014). There are no Functions, so the Workers request quota is not used.
- **GitHub Actions**: free for a public repository.
