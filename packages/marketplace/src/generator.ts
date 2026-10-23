import {
  GUIDE_IMAGE_EXTENSIONS,
  guideImagePath,
  guideImageSources,
  readZip,
  type Permissions,
} from "@tessello/convention";
import { sha256 } from "./sha256.ts";
import type { Namespaces } from "./verify.ts";
import { issue, namespaceOf, type Entry, type EntryVersion, type Issue } from "./entry.ts";

/** The version of the index.json format. */
export const INDEX_FORMAT = 1;

/** "listed" unless the listing is banned (Ban wins) or withdrawn (Withdrawal). */
export type ModuleState = "listed" | "withdrawn" | "banned";

export interface MarketplaceIndex {
  format: 1;
  /** ISO 8601 date of generation. */
  generatedAt: string;
  /** Every listed, withdrawn or banned Module, sorted by id. */
  modules: IndexModule[];
}

export interface IndexModule {
  id: string;
  /** The Creator: the namespace with its "@", e.g. "@craftskillz". */
  creator: string;
  source: string;
  license: string;
  tags: string[];
  /** Asset paths of the screenshots, relative to index.json: "modules/<namespace>/<name>/<file>". */
  screenshots: string[];
  /** The listing's versions, as listed (oldest first), with their withdrawn/banned marks. */
  versions: EntryVersion[];
  state: ModuleState;
  /** The Ban's reason, when state is "banned". */
  reason?: string;
  /** What the newest version that is neither withdrawn nor banned says of itself; null when there is none, or its package is missing or unreadable. */
  latest: IndexRelease | null;
}

export interface IndexRelease {
  version: string;
  url: string;
  sha256: string;
  name: string;
  description?: string;
  /** Asset path of the icon: "modules/<namespace>/<name>/<version>/<package path>". */
  icon: string;
  convention: number;
  permissions: Permissions;
  /** The Widget's size, or null when the Module has no Widget. */
  widget: { size: "S" | "M" | "L" } | null;
  guide: {
    /** Package path of the guide, against which its images resolve (renderGuide's `guide` argument). */
    path: string;
    markdown: string;
    /** Package path → asset path, for each image of the guide found in the package. */
    images: Record<string, string>;
  };
}

export interface IndexInput {
  /** Each listing (already accepted by the Verifier) with the files of its folder other than entry.json (screenshots). */
  listings: ReadonlyArray<{ entry: Entry; files: ReadonlyMap<string, Uint8Array> }>;
  /** "<id>@<version>" → the downloaded .zip. Only the version each listing describes needs to be there. */
  packages: ReadonlyMap<string, Uint8Array>;
  generatedAt: Date;
  /** The Maintainer's namespaces.json; a Module of a banned Namespace is banned. Absent means none. */
  namespaces?: Namespaces;
}

export interface GeneratedIndex {
  index: MarketplaceIndex;
  /** Asset path → bytes: the icons, guide images and screenshots index.json points to. */
  assets: Map<string, Uint8Array>;
  /** Problems that left a Module without `latest` or a screenshot out. Never throws. */
  issues: Issue[];
}

/** Builds index.json and the assets it points to from the accepted listings and the packages of their newest versions. */
export async function buildIndex(input: IndexInput): Promise<GeneratedIndex> {
  const assets = new Map<string, Uint8Array>();
  const issues: Issue[] = [];
  const modules: IndexModule[] = [];
  for (const { entry, files } of input.listings) {
    const folder = `modules/${entry.id.slice(1)}`;
    const namespace = namespaceOf(entry);
    const recorded = input.namespaces?.[namespace];
    const namespaceBan = recorded?.state === "banned" ? (recorded.reason ?? `The Namespace @${namespace} is banned.`) : undefined;
    const banned = entry.banned ?? namespaceBan;
    const state: ModuleState = banned !== undefined ? "banned" : entry.withdrawn ? "withdrawn" : "listed";
    const module: IndexModule = {
      id: entry.id,
      creator: entry.id.slice(0, entry.id.indexOf("/")),
      source: entry.source,
      license: entry.license,
      tags: entry.tags ?? [],
      screenshots: [],
      versions: entry.versions,
      state,
      latest: null,
    };
    if (banned !== undefined) module.reason = banned;

    for (const file of entry.screenshots ?? []) {
      const bytes = files.get(file);
      if (!bytes) {
        issues.push(issue("index/screenshot-missing", `${entry.id}: the screenshot ${JSON.stringify(file)} is listed but absent from the listing folder.`, { file }));
        continue;
      }
      module.screenshots.push(`${folder}/${file}`);
      assets.set(`${folder}/${file}`, bytes);
    }

    const newest = describedVersion(entry);
    if (newest) module.latest = await readRelease(entry.id, folder, newest, input.packages, assets, issues);
    modules.push(module);
  }
  modules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { index: { format: INDEX_FORMAT, generatedAt: input.generatedAt.toISOString(), modules }, assets, issues };
}

/** The version a listing is described by: the newest one that is neither withdrawn nor banned. */
export function describedVersion(entry: Entry): EntryVersion | undefined {
  return [...entry.versions].reverse().find((version) => !version.withdrawn && version.banned === undefined);
}

/** What a version's package says of itself, or null (with an issue) when it cannot be trusted. Its assets are added only then. */
async function readRelease(
  id: string,
  folder: string,
  listed: EntryVersion,
  packages: ReadonlyMap<string, Uint8Array>,
  assets: Map<string, Uint8Array>,
  issues: Issue[],
): Promise<IndexRelease | null> {
  const at = { version: listed.version };
  const bytes = packages.get(`${id}@${listed.version}`);
  if (!bytes) {
    issues.push(issue("index/package-missing", `${id}: the package of version ${listed.version} was not downloaded.`, at));
    return null;
  }
  const actual = await sha256(bytes);
  if (actual !== listed.sha256) {
    issues.push(issue("index/sha256-mismatch", `${id}: the package of version ${listed.version} has SHA-256 ${actual}, but the listing says ${listed.sha256}.`, at));
    return null;
  }
  const { report, files } = readZip(bytes);
  const manifest = report.manifest;
  const markdownBytes = manifest && files?.get(manifest.guide);
  if (!manifest || !files || !markdownBytes) {
    issues.push(issue("index/invalid-package", `${id}: the package of version ${listed.version} is not a valid Module package.`, at));
    return null;
  }

  const base = `${folder}/${listed.version}`;
  const markdown = new TextDecoder().decode(markdownBytes);
  const found = new Map<string, Uint8Array>();
  const images: Record<string, string> = {};
  const iconBytes = files.get(manifest.icon);
  if (iconBytes) found.set(manifest.icon, iconBytes);
  for (const src of guideImageSources(markdown)) {
    const path = guideImagePath(manifest.guide, src);
    const image = path === null ? undefined : files.get(path);
    if (path === null || !image || !GUIDE_IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))) continue;
    found.set(path, image);
    images[path] = `${base}/${path}`;
  }
  for (const [path, content] of found) assets.set(`${base}/${path}`, content);

  const release: IndexRelease = {
    version: listed.version,
    url: listed.url,
    sha256: listed.sha256,
    name: manifest.name,
    icon: `${base}/${manifest.icon}`,
    convention: manifest.convention,
    permissions: manifest.permissions ?? {},
    widget: manifest.widget ? { size: manifest.widget.size } : null,
    guide: { path: manifest.guide, markdown, images },
  };
  if (manifest.description !== undefined) release.description = manifest.description;
  return release;
}
