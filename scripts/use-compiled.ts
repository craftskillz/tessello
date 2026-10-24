// Loaded with `node --import`, it makes every import of a published package's sources load its compiled `dist/` instead,
// so that the existing tests run against the JavaScript that npm gets. Run with `npm run test:compiled`.

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLISHED } from "./build-packages.ts";

const sources = PUBLISHED.map((name) => {
  const root = pathToFileURL(fileURLToPath(new URL(`../packages/${name}/`, import.meta.url))).href;
  return { src: `${root}src/`, dist: `${root}dist/` };
});

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    const from = sources.find(({ src }) => resolved.url.startsWith(src));
    if (!from) return resolved;
    const url = from.dist + resolved.url.slice(from.src.length).replace(/\.ts$/, ".js");
    // A source file with no compiled counterpart would silently be tested as TypeScript: better fail loudly.
    if (!existsSync(fileURLToPath(url))) throw new Error(`${resolved.url} has no compiled file at ${url} (npm run build:packages).`);
    return { ...resolved, url };
  },
});
