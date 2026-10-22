// Builds the SDK as one dependency-free ES module that a Creator copies into a package (no network Permission needed),
// and writes it into every example Module. Run with `npm run build:sdk`.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Where the example Modules keep their local copy of the SDK. */
export const LOCAL_COPIES = ["notes", "meteo", "prometheus"].map((name) => at(`../../../examples/${name}/tessello-sdk.js`));

export async function buildLocalCopy(): Promise<string> {
  const source = await readFile(at("../src/index.ts"), "utf8");
  const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
  // The MIT License asks for its notice in every copy, and this file is copied on its own into Modules.
  return `// Tessello SDK (built from @tessello/sdk). Copy this file into your Module and import it with a relative path.\n// Copyright (c) 2026 Medaghri-Alaoui Youssef. MIT License: https://opensource.org/licenses/MIT\n${code}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await buildLocalCopy();
  for (const path of LOCAL_COPIES) await writeFile(path, code);
}
