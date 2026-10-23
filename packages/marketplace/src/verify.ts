import { OSI_LICENSES } from "./licenses.ts";
import { readZip } from "@tessello/convention";
import { compareVersions } from "./semver.ts";
import { issue, parseEntry, show, type Entry, type Issue } from "./entry.ts";

/** namespaces.json: namespace (without "@") → its GitHub account. */
export type Namespaces = Readonly<Record<string, NamespaceRecord>>;

export interface NamespaceRecord {
  /** GitHub login of the account or organisation. */
  account: string;
  /** Its numeric GitHub id, which never changes. */
  id: number;
  state: "active" | "frozen" | "banned";
  /** Why the namespace is banned. */
  reason?: string;
}

/** What the CI read from GitHub for this pull request. */
export interface GitHubFacts {
  /** The author of the pull request. */
  author: { login: string; id: number };
  /** The GitHub account named like the namespace, or null when there is none. */
  namespaceAccount: { login: string; id: number; type: "User" | "Organization" } | null;
  /** Whether the author is a public member of `namespaceAccount`, when it is an organisation. */
  authorIsPublicMember: boolean;
  /** The source repository, or null when GitHub does not find it. `license` is the SPDX id GitHub reports, or null. */
  source: { private: boolean; license: string | null } | null;
}

export interface VerifyInput {
  /** The listing folder under modules/, "<namespace>/<name>". */
  folder: string;
  /** entry.json of the pull request, as parsed JSON. */
  entry: unknown;
  /** entry.json on the base branch, or null for a new Module (already accepted, so trusted). */
  previous: Entry | null;
  /** version → downloaded .zip, for each version the pull request adds. */
  packages: ReadonlyMap<string, Uint8Array>;
  /** file name → content, the files of the listing folder other than entry.json. */
  files: ReadonlyMap<string, Uint8Array>;
  github: GitHubFacts;
  namespaces: Namespaces;
}

export type ChangeType = "new-module" | "new-version" | "metadata" | "other";

export interface Verdict {
  /** True when there is no issue. */
  ok: boolean;
  issues: Issue[];
  /** What the pull request changes; null when entry.json cannot be read. */
  change: ChangeType | null;
}

const RESERVED_NAMESPACE = "tessello";
/** Largest screenshot file, in bytes. */
export const MAX_SCREENSHOT_BYTES = 500 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Says whether a pull request's listing is acceptable, and what kind of change it is. Never throws. */
export async function verifyEntry(input: VerifyInput): Promise<Verdict> {
  const parsed = parseEntry(input.entry);
  if (!parsed.entry) return { ok: false, issues: parsed.issues, change: null };
  const entry = parsed.entry;
  const issues: Issue[] = [];

  if (entry.id !== `@${input.folder}`) {
    issues.push(issue("entry/folder-mismatch", `entry.json: "id" is ${show(entry.id)} but the listing folder is modules/${input.folder}, which holds "@${input.folder}".`));
  }

  checkNamespace(input, entry, issues);
  checkSource(input.github.source, entry, issues);
  checkPublishedVersions(input.previous, entry, issues);
  await checkNewVersions(input, entry, issues);
  checkScreenshots(input.files, entry, issues);

  return { ok: issues.length === 0, issues, change: changeType(input.previous, entry) };
}

function checkNamespace(input: VerifyInput, entry: Entry, issues: Issue[]): void {
  const namespace = entry.id.slice(1, entry.id.indexOf("/"));
  if (namespace === RESERVED_NAMESPACE) {
    issues.push(issue("namespace/reserved", `The namespace "@${namespace}" is reserved for Tessello.`));
    return;
  }
  const { author, namespaceAccount, authorIsPublicMember } = input.github;
  if (!namespaceAccount) {
    issues.push(issue("namespace/no-account", `The namespace "@${namespace}" must be the name of a GitHub account, and none is named ${show(namespace)}.`));
    return;
  }
  const owner = namespaceAccount.type === "User" ? author.id === namespaceAccount.id : authorIsPublicMember;
  if (!owner) {
    const who = namespaceAccount.type === "User" ? "that user" : "a public member of that organisation";
    issues.push(issue("namespace/not-owner", `The namespace "@${namespace}" belongs to the GitHub account ${show(namespaceAccount.login)}, and the pull request author ${show(author.login)} is not ${who}.`));
  }
  const recorded = input.namespaces[namespace];
  if (recorded && recorded.id !== namespaceAccount.id) {
    issues.push(
      issue(
        "namespace/id-mismatch",
        `The namespace "@${namespace}" was recorded for GitHub account id ${recorded.id} (${show(recorded.account)}), but the account named ${show(namespace)} now has id ${namespaceAccount.id}.`,
      ),
    );
  }
}

function checkSource(source: GitHubFacts["source"], entry: Entry, issues: Issue[]): void {
  if (!source) {
    issues.push(issue("source/not-found", `GitHub does not find the source repository ${show(entry.source)}.`));
  } else if (source.private) {
    issues.push(issue("source/private", `The source repository ${show(entry.source)} is private: it must be public.`));
  }
  if (!OSI_LICENSES.has(entry.license)) {
    issues.push(issue("license/not-osi", `entry.json: "license" ${show(entry.license)} is not an OSI-approved SPDX identifier.`));
  }
  if (!source) return;
  if (source.license === null) {
    issues.push(issue("license/not-reported", `GitHub reports no licence for ${show(entry.source)}, which must carry ${show(entry.license)}.`));
  } else if (source.license !== entry.license) {
    issues.push(issue("license/mismatch", `entry.json declares the licence ${show(entry.license)} but GitHub reports ${show(source.license)} for ${show(entry.source)}.`));
  }
}

function changeType(previous: Entry | null, entry: Entry): ChangeType {
  if (!previous) return "new-module";
  if (
    entry.id !== previous.id ||
    entry.source !== previous.source ||
    entry.license !== previous.license ||
    entry.withdrawn !== previous.withdrawn ||
    entry.banned !== previous.banned ||
    previous.versions.some((published) => {
      const now = entry.versions.find((v) => v.version === published.version);
      return !now || now.url !== published.url || now.sha256 !== published.sha256 || now.withdrawn !== published.withdrawn || now.banned !== published.banned;
    })
  ) {
    return "other";
  }
  return entry.versions.length > previous.versions.length ? "new-version" : "metadata";
}

/** A published version stays as it is: its package is what users already installed. */
function checkPublishedVersions(previous: Entry | null, entry: Entry, issues: Issue[]): void {
  for (const published of previous?.versions ?? []) {
    const now = entry.versions.find((v) => v.version === published.version);
    const at = { version: published.version };
    if (!now) {
      issues.push(issue("version/published-removed", `Published version ${show(published.version)} cannot be removed from entry.json.`, at));
    } else if (now.url !== published.url || now.sha256 !== published.sha256) {
      issues.push(issue("version/published-changed", `The "url" and "sha256" of published version ${show(published.version)} cannot change.`, at));
    }
  }
}

/** The versions the pull request adds are checked in list order, each against every version before it. */
async function checkNewVersions(input: VerifyInput, entry: Entry, issues: Issue[]): Promise<void> {
  const published = new Set(input.previous?.versions.map((v) => v.version));
  const earlier: string[] = [...published];
  for (const listed of entry.versions) {
    if (published.has(listed.version)) continue;
    const at = { version: listed.version };
    if (earlier.some((other) => compareVersions(listed.version, other) <= 0)) {
      issues.push(issue("version/not-greater", `Version ${show(listed.version)} must be greater than every version listed before it.`, at));
    }
    earlier.push(listed.version);
    if (new URL(listed.url).protocol !== "https:") {
      issues.push(issue("version/insecure-url", `The URL of version ${show(listed.version)} must use https, got ${show(listed.url)}.`, at));
    }
    const bytes = input.packages.get(listed.version);
    if (!bytes) {
      issues.push(issue("version/package-missing", `No package was downloaded for version ${show(listed.version)} from ${show(listed.url)}.`, at));
      continue;
    }
    const actual = await sha256(bytes);
    if (actual !== listed.sha256) {
      issues.push(issue("version/sha256-mismatch", `The package of version ${show(listed.version)} has SHA-256 ${actual}, but entry.json lists ${listed.sha256}.`, at));
      continue;
    }
    checkPackage(bytes, entry, listed.version, issues);
  }
}

function checkScreenshots(files: VerifyInput["files"], entry: Entry, issues: Issue[]): void {
  for (const name of entry.screenshots ?? []) {
    const at = { file: name };
    const bytes = files.get(name);
    if (!bytes) {
      issues.push(issue("screenshot/missing", `Screenshot ${show(name)} is listed in entry.json but is not in the listing folder.`, at));
      continue;
    }
    if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
      issues.push(issue("screenshot/too-large", `Screenshot ${show(name)} is ${bytes.byteLength} bytes, at most ${MAX_SCREENSHOT_BYTES} (500 KB) are allowed.`, at));
    }
    const isPng = name.toLowerCase().endsWith(".png");
    if (!(isPng ? looksLikePng(bytes) : looksLikeWebp(bytes))) {
      issues.push(issue("screenshot/invalid-image", `Screenshot ${show(name)} is not a valid ${isPng ? "PNG" : "WebP"} image.`, at));
    }
  }
}

function looksLikePng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

/** A WebP file starts with "RIFF", a 4-byte size, then "WEBP". */
function looksLikeWebp(bytes: Uint8Array): boolean {
  const at = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  return bytes.byteLength >= 12 && at(0) === "RIFF" && at(8) === "WEBP";
}

function checkPackage(bytes: Uint8Array, entry: Entry, version: string, issues: Issue[]): void {
  const { report } = readZip(bytes);
  for (const found of report.issues) {
    if (found.severity !== "error") continue;
    issues.push({ code: found.code, message: found.message, version, ...(found.file !== undefined && { file: found.file }) });
  }
  const { manifest } = report;
  if (!manifest) return;
  if (manifest.id !== entry.id) {
    issues.push(issue("version/id-mismatch", `The Manifest of version ${show(version)} has id ${show(manifest.id)}, but the entry is ${show(entry.id)}.`, { version }));
  }
  if (manifest.version !== version) {
    issues.push(issue("version/version-mismatch", `The Manifest of version ${show(version)} says version ${show(manifest.version)}.`, { version }));
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
