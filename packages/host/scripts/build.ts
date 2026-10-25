// Builds the Host into a static site in `dist/`: index.html, its stylesheet, one bundled script, the service worker,
// manifest and icon that make it an installable app, and Cloudflare's `_headers`.
// Run with `npm run build:host`.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { headersFile } from "./headers.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export const DIST = at("../dist");

/** The files the service worker keeps available offline, relative to the Host. */
const SHELL = ["index.html", "main.js", "style.css", "manifest.webmanifest", "icon.svg"];

export async function buildHost(): Promise<void> {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await build({
    entryPoints: [at("../src/main.ts")],
    outfile: `${DIST}/main.js`,
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: true,
    logLevel: "warning",
  });
  await copyFile(at("../src/index.html"), `${DIST}/index.html`);
  await copyFile(at("../src/style.css"), `${DIST}/style.css`);
  await copyFile(at("../src/manifest.webmanifest"), `${DIST}/manifest.webmanifest`);
  await copyFile(at("../src/icon.svg"), `${DIST}/icon.svg`);
  // The version follows the shell's content: a deployment that changes a file changes sw.js, so browsers install it.
  const hash = createHash("sha256");
  for (const file of SHELL) hash.update(await readFile(`${DIST}/${file}`));
  await build({
    entryPoints: [at("../src/service-worker.ts")],
    outfile: `${DIST}/sw.js`,
    bundle: true,
    format: "iife",
    target: "es2022",
    define: { __SHELL__: JSON.stringify(SHELL), __VERSION__: JSON.stringify(hash.digest("hex").slice(0, 12)) },
    logLevel: "warning",
  });
  await writeFile(`${DIST}/_headers`, headersFile());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildHost();
