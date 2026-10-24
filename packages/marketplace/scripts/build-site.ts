// Builds the Marketplace site (index.json, assets, pages, search.js) from a checkout of the Marketplace repository.
// Run with `npm run build:marketplace -- --repo <dir> --out <dir> --host <url> [--packages <dir>]`.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import { buildIndex, describedVersion, parseEntry, renderSite, type IndexInput, type Issue, type Namespaces } from "../src/index.ts";

const SEARCH_ENTRY = fileURLToPath(new URL("../src/site/search.ts", import.meta.url));

/** Cloudflare Pages' headers file: every Host, whatever its origin, reads index.json and the assets under modules/. */
const HEADERS = `/index.json
  Access-Control-Allow-Origin: *

/modules/*
  Access-Control-Allow-Origin: *
`;

export interface BuildSiteOptions {
  /** A checkout of the Marketplace repository: `modules/<namespace>/<name>/entry.json` and the files next to it. */
  repo: string;
  /** The folder the site is written to. It is emptied first. */
  out: string;
  /** The Host's address, for the install links. */
  hostUrl: string;
  /** A folder of packages, `<namespace>/<name>/<version>.zip`, used instead of downloading them. */
  packages?: string;
  now?: Date;
}

/** Writes the site and returns the problems found (an unreadable listing, or what buildIndex reports). Never throws on a listing. */
export async function buildSite(options: BuildSiteOptions): Promise<Issue[]> {
  const issues: Issue[] = [];
  const listings: IndexInput["listings"][number][] = [];
  const packages = new Map<string, Uint8Array>();

  for (const namespace of await folders(join(options.repo, "modules"))) {
    for (const name of await folders(join(options.repo, "modules", namespace))) {
      const folder = join(options.repo, "modules", namespace, name);
      const where = `modules/${namespace}/${name}`;
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(join(folder, "entry.json"), "utf8"));
      } catch (error) {
        issues.push({ code: "site/unreadable-entry", message: `${where}/entry.json cannot be read: ${(error as Error).message}`, file: "entry.json" });
        continue;
      }
      const { entry, issues: found } = parseEntry(raw);
      if (!entry) {
        issues.push(...found.map((one) => ({ ...one, message: `${where}: ${one.message}` })), { code: "site/unreadable-entry", message: `${where}/entry.json is not a valid listing, skipped.`, file: "entry.json" });
        continue;
      }
      const files = new Map<string, Uint8Array>();
      for (const file of await readdir(folder, { withFileTypes: true })) {
        if (file.isFile() && file.name !== "entry.json") files.set(file.name, await readFile(join(folder, file.name)));
      }
      listings.push({ entry, files });

      const version = describedVersion(entry);
      if (!version) continue;
      const bytes = options.packages
        ? await readFile(join(options.packages, namespace, name, `${version.version}.zip`)).catch(() => undefined)
        : await download(version.url);
      if (bytes) packages.set(`${entry.id}@${version.version}`, bytes);
    }
  }

  const namespaces = await readNamespaces(options.repo, issues);
  const generated = await buildIndex({ listings, packages, namespaces, generatedAt: options.now ?? new Date() });
  issues.push(...generated.issues);

  await rm(options.out, { recursive: true, force: true });
  await mkdir(options.out, { recursive: true });
  const put = async (path: string, content: string | Uint8Array) => {
    await mkdir(dirname(join(options.out, path)), { recursive: true });
    await writeFile(join(options.out, path), content);
  };
  await put("index.json", JSON.stringify(generated.index));
  for (const [path, bytes] of generated.assets) await put(path, bytes);
  for (const [path, content] of renderSite(generated.index, { hostUrl: options.hostUrl })) await put(path, content);
  await put("_headers", HEADERS);
  await build({
    entryPoints: [SEARCH_ENTRY],
    outfile: join(options.out, "search.js"),
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    logLevel: "warning",
  });
  return issues;
}

/** The Maintainer's namespaces.json at the root of the repository: none when absent, none (with an issue) when unreadable. */
async function readNamespaces(repo: string, issues: Issue[]): Promise<Namespaces> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(repo, "namespaces.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    raw = undefined;
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return raw as Namespaces;
  issues.push({ code: "site/unreadable-namespaces", message: "namespaces.json is not a readable JSON object: it is ignored.", file: "namespaces.json" });
  return {};
}

/** The sub-folders of a folder, or none when it does not exist. */
async function folders(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/** The bytes at a URL, or undefined when the download fails (buildIndex then reports the missing package). */
async function download(url: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(url);
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { repo: { type: "string" }, out: { type: "string" }, host: { type: "string" }, packages: { type: "string" } } });
  if (!values.repo || !values.out || !values.host) {
    console.error("Usage: build-site.ts --repo <dir> --out <dir> --host <url> [--packages <dir>]");
    process.exit(2);
  }
  const issues = await buildSite({ repo: values.repo, out: values.out, hostUrl: values.host, ...(values.packages ? { packages: values.packages } : {}) });
  for (const one of issues) console.warn(`warning [${one.code}] ${one.message}`);
  console.log(`Site written to ${values.out} (${issues.length} warning${issues.length === 1 ? "" : "s"}).`);
}
