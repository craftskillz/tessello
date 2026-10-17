// Builds the Host into a static site in `dist/`: index.html, its stylesheet and one bundled script.
// Run with `npm run build:host`.

import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export const DIST = at("../dist");

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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildHost();
