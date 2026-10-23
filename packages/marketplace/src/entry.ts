import { isModuleId, isSemver } from "@tessello/convention";

export interface EntryVersion {
  version: string;
  url: string;
  /** SHA-256 of the .zip, lowercase hex. */
  sha256: string;
  withdrawn?: true;
  banned?: string;
}

export interface Entry {
  id: string;
  source: string;
  license: string;
  tags?: string[];
  screenshots?: string[];
  versions: EntryVersion[];
  withdrawn?: true;
  banned?: string;
}

/** A reason to refuse a listing. The Verifier only reports errors. */
export interface Issue {
  /** Stable machine-readable code, e.g. "entry/invalid-id". */
  code: string;
  message: string;
  /** The version the issue relates to, when there is one. */
  version?: string;
  /** File of the listing folder the issue relates to, when there is one. */
  file?: string;
}

const ENTRY = "entry.json";
const MAX_TAGS = 10;
const MAX_SCREENSHOTS = 3;
const KNOWN_FIELDS = new Set(["id", "source", "license", "tags", "screenshots", "versions", "withdrawn", "banned"]);
const KNOWN_VERSION_FIELDS = new Set(["version", "url", "sha256", "withdrawn", "banned"]);
const SOURCE_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9-]+\/(?![A-Za-z0-9._-]*\.git$)[A-Za-z0-9._-]+$/;
const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SCREENSHOT_PATTERN = /\.(?:png|webp)$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Reads a parsed entry.json. Never throws. `entry` is null whenever there is an issue. */
export function parseEntry(raw: unknown): { entry: Entry | null; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!isObject(raw)) {
    issues.push(issue("entry/invalid-json", `${ENTRY} must contain a JSON object, got ${show(raw)}.`));
    return { entry: null, issues };
  }

  for (const name of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(name)) issues.push(issue("entry/unknown-field", `${ENTRY}: unknown field "${name}".`));
  }

  const id = text(raw, "id", issues);
  if (id !== undefined && !isModuleId(id)) {
    issues.push(issue("entry/invalid-id", `${ENTRY}: "id" must be a Module Identifier like "@namespace/name", got ${show(id)}.`));
  }
  const source = text(raw, "source", issues);
  if (source !== undefined && !SOURCE_PATTERN.test(source)) {
    issues.push(
      issue("entry/invalid-source", `${ENTRY}: "source" must be exactly "https://github.com/<owner>/<repo>", got ${show(source)}.`),
    );
  }
  const license = text(raw, "license", issues);
  if (license !== undefined && license === "") {
    issues.push(issue("entry/invalid-license", `${ENTRY}: "license" must be an SPDX identifier, got ${show(license)}.`));
  }

  const tags = "tags" in raw ? checkTags(raw.tags, issues) : undefined;
  const screenshots = "screenshots" in raw ? checkScreenshots(raw.screenshots, issues) : undefined;
  const versions = checkVersions(raw, issues);
  const withdrawn = checkWithdrawn(raw, `${ENTRY}: "withdrawn"`, issues);
  const banned = checkBanned(raw, `${ENTRY}: "banned"`, issues);

  if (issues.length > 0) return { entry: null, issues };
  const entry: Entry = { id: id as string, source: source as string, license: license as string, versions: versions as EntryVersion[] };
  if (tags) entry.tags = tags;
  if (screenshots) entry.screenshots = screenshots;
  if (withdrawn) entry.withdrawn = true;
  if (banned !== undefined) entry.banned = banned;
  return { entry, issues };
}

function checkTags(value: unknown, issues: Issue[]): string[] | undefined {
  const list = stringList(value, "tags", issues);
  if (!list) return undefined;
  for (const tag of list) {
    if (!TAG_PATTERN.test(tag)) {
      issues.push(issue("entry/invalid-tag", `${ENTRY}: tag ${show(tag)} must be 1 to 32 lowercase letters, digits or hyphens, not starting with a hyphen.`));
    }
  }
  if (list.length > MAX_TAGS) {
    issues.push(issue("entry/too-many-tags", `${ENTRY}: "tags" has ${list.length} tags, at most ${MAX_TAGS} are allowed.`));
  }
  for (const tag of duplicates(list)) issues.push(issue("entry/duplicate-tag", `${ENTRY}: tag ${show(tag)} is listed twice.`));
  return list;
}

function checkScreenshots(value: unknown, issues: Issue[]): string[] | undefined {
  const list = stringList(value, "screenshots", issues);
  if (!list) return undefined;
  for (const name of list) {
    if (!isPlainFileName(name) || !SCREENSHOT_PATTERN.test(name)) {
      issues.push(
        issue("entry/invalid-screenshot", `${ENTRY}: screenshot ${show(name)} must be a file name of the listing folder ending in .png or .webp.`, {
          file: name,
        }),
      );
    }
  }
  if (list.length > MAX_SCREENSHOTS) {
    issues.push(
      issue("entry/too-many-screenshots", `${ENTRY}: "screenshots" has ${list.length} files, at most ${MAX_SCREENSHOTS} are allowed.`),
    );
  }
  for (const name of duplicates(list)) {
    issues.push(issue("entry/duplicate-screenshot", `${ENTRY}: screenshot ${show(name)} is listed twice.`, { file: name }));
  }
  return list;
}

function checkVersions(raw: Record<string, unknown>, issues: Issue[]): EntryVersion[] | undefined {
  if (!("versions" in raw)) {
    issues.push(issue("entry/missing-field", `${ENTRY}: missing required field "versions".`));
    return undefined;
  }
  if (!Array.isArray(raw.versions)) {
    issues.push(issue("entry/invalid-type", `${ENTRY}: "versions" must be an array, got ${show(raw.versions)}.`));
    return undefined;
  }
  if (raw.versions.length === 0) {
    issues.push(issue("entry/no-versions", `${ENTRY}: "versions" must list at least one version.`));
    return undefined;
  }
  const result: EntryVersion[] = [];
  const seen = new Set<string>();
  const before = issues.length;
  for (const item of raw.versions) {
    if (!isObject(item)) {
      issues.push(issue("entry/invalid-type", `${ENTRY}: each item of "versions" must be an object, got ${show(item)}.`));
      continue;
    }
    const parsed = checkVersion(item, issues);
    if (!parsed) continue;
    if (seen.has(parsed.version)) {
      issues.push(issue("entry/duplicate-version", `${ENTRY}: version ${show(parsed.version)} is listed twice.`, { version: parsed.version }));
    }
    seen.add(parsed.version);
    result.push(parsed);
  }
  return issues.length === before ? result : undefined;
}

function checkVersion(item: Record<string, unknown>, issues: Issue[]): EntryVersion | undefined {
  const label = typeof item.version === "string" ? item.version : undefined;
  const at = label === undefined ? {} : { version: label };
  const before = issues.length;
  const field = (name: string) => `${ENTRY}: "${name}" of ${label === undefined ? "a version" : `version ${show(label)}`}`;

  for (const name of Object.keys(item)) {
    if (!KNOWN_VERSION_FIELDS.has(name)) {
      issues.push(issue("entry/unknown-field", `${ENTRY}: unknown field "${name}" in ${label === undefined ? "a version" : `version ${show(label)}`}.`, at));
    }
  }
  const version = versionText(item, "version", label, at, issues);
  const url = versionText(item, "url", label, at, issues);
  const sha256 = versionText(item, "sha256", label, at, issues);
  if (version !== undefined && !isSemver(version)) {
    issues.push(issue("entry/invalid-version", `${ENTRY}: ${show(version)} is not a semver version.`, at));
  }
  if (url !== undefined && !canParseUrl(url)) {
    issues.push(issue("entry/invalid-url", `${field("url")} must be a URL, got ${show(url)}.`, at));
  }
  if (sha256 !== undefined && !SHA256_PATTERN.test(sha256)) {
    issues.push(issue("entry/invalid-sha256", `${field("sha256")} must be 64 lowercase hexadecimal characters, got ${show(sha256)}.`, at));
  }
  const withdrawn = checkWithdrawn(item, field("withdrawn"), issues, at);
  const banned = checkBanned(item, field("banned"), issues, at);

  if (issues.length > before) return label === undefined ? undefined : { version: label, url: "", sha256: "" };
  const result: EntryVersion = { version: version as string, url: url as string, sha256: sha256 as string };
  if (withdrawn) result.withdrawn = true;
  if (banned !== undefined) result.banned = banned;
  return result;
}

function checkWithdrawn(source: Record<string, unknown>, where: string, issues: Issue[], at: Partial<Issue> = {}): true | undefined {
  if (!("withdrawn" in source)) return undefined;
  if (source.withdrawn === true) return true;
  issues.push(issue("entry/invalid-withdrawn", `${where} must be true when present, got ${show(source.withdrawn)}.`, at));
  return undefined;
}

function checkBanned(source: Record<string, unknown>, where: string, issues: Issue[], at: Partial<Issue> = {}): string | undefined {
  if (!("banned" in source)) return undefined;
  if (typeof source.banned === "string" && source.banned !== "") return source.banned;
  issues.push(issue("entry/invalid-banned", `${where} must be a non-empty reason, got ${show(source.banned)}.`, at));
  return undefined;
}

/** A required string field of the entry; reports a missing field or a wrong type. */
function text(source: Record<string, unknown>, name: string, issues: Issue[]): string | undefined {
  if (!(name in source)) {
    issues.push(issue("entry/missing-field", `${ENTRY}: missing required field "${name}".`));
    return undefined;
  }
  if (typeof source[name] !== "string") {
    issues.push(issue("entry/invalid-type", `${ENTRY}: "${name}" must be a string, got ${show(source[name])}.`));
    return undefined;
  }
  return source[name];
}

/** A required string field of a version; reports a missing field or a wrong type. */
function versionText(
  source: Record<string, unknown>,
  name: string,
  label: string | undefined,
  at: Partial<Issue>,
  issues: Issue[],
): string | undefined {
  const where = label === undefined ? "a version" : `version ${show(label)}`;
  if (!(name in source)) {
    issues.push(issue("entry/missing-field", `${ENTRY}: ${where} is missing required field "${name}".`, at));
    return undefined;
  }
  if (typeof source[name] !== "string") {
    issues.push(issue("entry/invalid-type", `${ENTRY}: "${name}" of ${where} must be a string, got ${show(source[name])}.`, at));
    return undefined;
  }
  return source[name];
}

function stringList(value: unknown, name: string, issues: Issue[]): string[] | undefined {
  if (!Array.isArray(value)) {
    issues.push(issue("entry/invalid-type", `${ENTRY}: "${name}" must be an array of strings, got ${show(value)}.`));
    return undefined;
  }
  const bad = value.findIndex((item) => typeof item !== "string");
  if (bad !== -1) {
    issues.push(issue("entry/invalid-type", `${ENTRY}: "${name}" must contain only strings, got ${show(value[bad])}.`));
    return undefined;
  }
  return value as string[];
}

function duplicates(list: string[]): string[] {
  return [...new Set(list.filter((item, index) => list.indexOf(item) !== index))];
}

function isPlainFileName(name: string): boolean {
  return name !== "" && name !== "." && name !== ".." && !name.includes("/") && !name.includes("\\");
}

function canParseUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An issue of the listing, located in entry.json unless `extra` says otherwise. */
export function issue(code: string, message: string, extra: Partial<Issue> = {}): Issue {
  return { code, message, file: ENTRY, ...extra };
}

export function show(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
