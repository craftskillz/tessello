// Compiles the packages published on npm into `packages/<name>/dist/`: JavaScript, type declarations, a package.json
// pointing at them, the README and the license. `dist/` is the package: publish it with `npm publish packages/<name>/dist`.
// Run with `npm run build:packages`.

import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { buildLocalCopy } from "../packages/sdk/scripts/build-local-copy.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** The published packages, each after the packages it depends on. */
export const PUBLISHED = ["sdk", "convention", "marketplace", "cli"] as const;
export type Published = (typeof PUBLISHED)[number];

export const distOf = (name: Published) => at(`../packages/${name}/dist`);

/** What a published package.json keeps from the workspace one; `exports` and `bin` are rewritten to `dist/`. */
const KEPT_FIELDS = ["name", "version", "description", "license", "type", "dependencies"];

export async function buildPackages(): Promise<void> {
  for (const name of PUBLISHED) await buildPackage(name);
}

async function buildPackage(name: Published): Promise<void> {
  const root = at(`../packages/${name}`);
  const dist = distOf(name);
  const source = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
  const entry = source.bin ? source.bin.tessello : source.exports;
  await rm(dist, { recursive: true, force: true });
  // A CLI is run, never imported: it needs no type declarations.
  compile(`${root}/${entry}`, `${root}/src`, dist, !source.bin);

  const manifest: Record<string, unknown> = {};
  for (const field of KEPT_FIELDS) if (source[field] !== undefined) manifest[field] = source[field];
  const js = (path: string) => `./${path.replace(/^\.\/src\//, "").replace(/\.ts$/, ".js")}`;
  if (source.bin) manifest.bin = { tessello: js(source.bin.tessello) };
  if (source.exports) {
    manifest.exports = { ".": { types: js(source.exports).replace(/\.js$/, ".d.ts"), default: js(source.exports) } };
  }
  manifest.repository = { type: "git", url: "git+https://github.com/craftskillz/tessello.git", directory: `packages/${name}` };
  manifest.homepage = "https://github.com/craftskillz/tessello#readme";
  manifest.engines = { node: ">=22.12" };
  await writeFile(`${dist}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  await copyFile(at("../LICENSE"), `${dist}/LICENSE`);
  await copyFile(`${root}/README.md`, `${dist}/README.md`);
  // The single-file copy a Creator puts in a package, so that a Module needs neither a build tool nor the network.
  if (name === "sdk") await writeFile(`${dist}/tessello-sdk.js`, await buildLocalCopy());
}

/** Compiles `entry` and the files it imports. Another published package is read from its `dist/` declarations. */
function compile(entry: string, rootDir: string, outDir: string, declaration: boolean): void {
  const paths: Record<string, string[]> = {};
  for (const name of PUBLISHED) paths[`@tessello/${name}`] = [`${distOf(name)}/index.d.ts`];
  const program = ts.createProgram([entry], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    rewriteRelativeImportExtensions: true,
    declaration,
    types: ["node"],
    rootDir,
    outDir,
    paths,
  });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  if (diagnostics.length > 0) {
    const host = { getCanonicalFileName: (f: string) => f, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n" };
    throw new Error(ts.formatDiagnostics(diagnostics, host));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPackages();
