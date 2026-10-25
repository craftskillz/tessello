// Compiles the packages published on npm into `packages/<name>/dist/`: JavaScript, type declarations, a package.json
// pointing at them, the README and the license. `dist/` is the package: publish it with `npm publish packages/<name>/dist`.
// Run with `npm run build:packages`.

import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
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
  // `exports` is the entry, or a map whose "." is the entry and whose other paths are entries of their own.
  const exportsMap: Record<string, string> | undefined =
    typeof source.exports === "string" ? { ".": source.exports } : source.exports;
  const entry = source.bin ? source.bin.tessello : exportsMap?.["."];
  await rm(dist, { recursive: true, force: true });
  // A CLI is run, never imported: it needs no type declarations.
  compile(`${root}/${entry}`, `${root}/src`, dist, !source.bin);

  const manifest: Record<string, unknown> = {};
  for (const field of KEPT_FIELDS) if (source[field] !== undefined) manifest[field] = source[field];
  const js = (path: string) => `./${path.replace(/^\.\/src\//, "").replace(/\.ts$/, ".js")}`;
  if (source.bin) manifest.bin = { tessello: js(source.bin.tessello) };
  if (exportsMap) {
    manifest.exports = Object.fromEntries(
      Object.entries(exportsMap).map(([path, file]) => [path, { types: js(file).replace(/\.js$/, ".d.ts"), default: js(file) }]),
    );
    for (const [path, file] of Object.entries(exportsMap)) if (path !== ".") await bundleEntry(`${root}/${file}`, dist);
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

/**
 * Compiles an entry other than the package's main one into a single file, with what it imports from the workspace's
 * unpublished packages, such as `@tessello/sdk/testing` and @tessello/host-core: the package keeps no dependency. Its
 * declarations are written from its own exports, which must not mention a type of those packages.
 */
async function bundleEntry(file: string, dist: string): Promise<void> {
  const out = `${dist}/${basename(file).replace(/\.ts$/, ".js")}`;
  await build({ entryPoints: [file], outfile: out, bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "error" });
  const { outputText, diagnostics = [] } = ts.transpileDeclaration(await readFile(file, "utf8"), {
    fileName: basename(file),
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, strict: true },
  });
  if (diagnostics.length > 0) throw new Error(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
  await writeFile(out.replace(/\.js$/, ".d.ts"), outputText.replace(/(from "\.\/[^"]+)\.ts"/g, '$1.js"'));
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
