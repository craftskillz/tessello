import { issue, issueNotInEntry, parseEntry, show, type Entry, type Issue } from "./entry.ts";
import { verifyEntry, type ChangeType, type GitHubFacts, type NamespaceRecord, type Namespaces } from "./verify.ts";

/** A file the pull request changes. `previousPath` is set for a rename. */
export interface ChangedFile {
  path: string;
  previousPath?: string;
}

/** What the CI reads, from GitHub and the web. The real implementation is a script; tests use an in-memory one. */
export interface PullRequestSource {
  changedFiles(): Promise<ChangedFile[]>;
  /** A file at the base or the head of the pull request, or null when absent. */
  file(side: "base" | "head", path: string): Promise<Uint8Array | null>;
  /** The entries directly in a folder: regular files with their bytes, and the names of anything else (sub-folder, symlink, submodule). Both empty when the folder does not exist. */
  folder(side: "base" | "head", path: string): Promise<{ files: Map<string, Uint8Array>; others: string[] }>;
  account(login: string): Promise<{ login: string; id: number; type: "User" | "Organization" } | null>;
  isPublicMember(organization: string, login: string): Promise<boolean>;
  /** Whether the login has write access to the Marketplace repository: the Maintainer, and no one else. */
  isMaintainer(login: string): Promise<boolean>;
  repository(owner: string, name: string): Promise<{ private: boolean; license: string | null } | null>;
  /** The bytes at an https URL, or null when the download fails. */
  download(url: string): Promise<Uint8Array | null>;
}

export type Decision = "merge" | "approval" | "maintainer" | "refuse";

export interface PullRequestCheck {
  /** "<namespace>/<name>", or null when the pull request does not touch exactly one listing folder. */
  folder: string | null;
  issues: Issue[];
  change: ChangeType | null;
  decision: Decision;
  /** For an acceptable new Module whose namespace is not in namespaces.json: the record its Approval adds. Else null. */
  namespace: { name: string; record: NamespaceRecord } | null;
  /** The namespace (without "@") whose GitHub account changed since it was recorded: the Namespace is frozen and the Maintainer decides. Else null. */
  freeze: string | null;
  /** The Markdown comment the CI posts on the pull request. */
  comment: string;
}

const LISTING_FILE = /^modules\/([^/]+)\/([^/]+)\/[^/]+$/;
const GITHUB_SOURCE = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/;
const TERMS = "I have read PUBLISHING.md and accept its terms.";
const TERMS_TICKED = new RegExp(`^ *[-*] \\[[xX]\\] ${TERMS.replaceAll(".", "\\.")}\\s*$`, "m");
const MARKER = "<!-- tessello-marketplace-check -->";
const ZERO_WIDTH_SPACE = "​";

/** Checks a pull request against the Marketplace rules and decides what happens to it. Reads packages as archives, never runs them. */
export async function checkPullRequest(input: { author: { login: string; id: number }; body: string; source: PullRequestSource }): Promise<PullRequestCheck> {
  const { author, body, source } = input;
  // The Creator's acceptance of PUBLISHING.md (ADR 0015) is a refusal like any issue, reported whatever else is wrong.
  const terms = TERMS_TICKED.test(body) ? [] : [issueNotInEntry("pull-request/terms-not-accepted", `Tick the box "${TERMS}" in the pull request description.`)];
  /** `namespace` is the record to add should the pull request await the Approval. */
  const result = (folder: string | null, found: Issue[], change: ChangeType | null, namespace: PullRequestCheck["namespace"] = null, freeze: string | null = null): PullRequestCheck => {
    const issues = [...found, ...terms];
    const decision = decide(issues, change);
    return { folder, issues, change, decision, namespace: decision === "approval" ? namespace : null, freeze, comment: renderComment(folder, issues, decision, freeze) };
  };

  const located = locateListing(await source.changedFiles());
  if ("issues" in located) return result(null, located.issues, null);
  const folder = located.folder;
  const path = `modules/${folder}`;

  const issues: Issue[] = [];
  const head = await source.folder("head", path);
  for (const name of head.others) {
    issues.push(issueNotInEntry("pull-request/unexpected-file", `${show(name)} is not a file: a listing folder holds only files.`, { file: name }));
  }
  const raw = head.files.get("entry.json") ?? (await source.file("head", `${path}/entry.json`));
  if (!raw) {
    issues.push(issue("pull-request/listing-removed", `modules/${folder}/entry.json is missing: a listing is never deleted, it is withdrawn instead.`));
    return result(folder, issues, null);
  }
  const json = parseJson(raw);
  if (json === undefined) {
    issues.push(issue("entry/invalid-json", "entry.json is not valid UTF-8 JSON."));
    return result(folder, issues, null);
  }

  const namespaces = await readBase(source, "namespaces.json", (value) => value as Namespaces, {});
  const previous = await readBase(source, `${path}/entry.json`, (value) => {
    const parsed = parseEntry(value);
    if (!parsed.entry) throw new Error(`The base ${path}/entry.json is not a valid listing: ${parsed.issues.map((i) => i.message).join(" ")}`);
    return parsed.entry;
  }, null);

  const [namespace = ""] = folder.split("/");
  const account = await source.account(namespace);
  const parsed = parseEntry(json).entry;
  const github: GitHubFacts = {
    author,
    namespaceAccount: account,
    authorIsPublicMember: account?.type === "Organization" ? await source.isPublicMember(namespace, author.login) : false,
    authorIsMaintainer: await source.isMaintainer(author.login),
    source: await findRepository(source, json),
  };

  const packages = new Map<string, Uint8Array>();
  const published = new Set(previous?.versions.map((v) => v.version));
  for (const listed of parsed?.versions ?? []) {
    if (published.has(listed.version) || !listed.url.startsWith("https://")) continue;
    const bytes = await source.download(listed.url);
    if (bytes) packages.set(listed.version, bytes);
  }
  const files = new Map(head.files);
  files.delete("entry.json");

  const verdict = await verifyEntry({ folder, entry: json, previous, packages, files, github, namespaces });
  issues.push(...verdict.issues);
  const record: NamespaceRecord | null = account && !(namespace in namespaces) ? { account: account.login, id: account.id, state: "active" } : null;
  return result(folder, issues, verdict.change, record && { name: namespace, record }, verdict.freeze ? namespace : null);
}

/** The one listing folder the pull request touches, or the issues saying why there is not exactly one. */
function locateListing(changed: ChangedFile[]): { folder: string } | { issues: Issue[] } {
  const issues: Issue[] = [];
  const folders = new Set<string>();
  const paths = new Set(changed.flatMap((file) => (file.previousPath === undefined ? [file.path] : [file.path, file.previousPath])));
  for (const path of paths) {
    const match = LISTING_FILE.exec(path);
    if (match) folders.add(`${match[1]}/${match[2]}`);
    else issues.push(issueNotInEntry("pull-request/outside-listing", `${show(path)} is not a file of a listing folder: a pull request only touches modules/<namespace>/<name>/<file>.`, { file: path }));
  }
  if (folders.size > 1) issues.push(issueNotInEntry("pull-request/several-listings", `A pull request touches one listing folder only, and this one touches ${[...folders].map((f) => `modules/${f}`).join(", ")}.`));
  if (paths.size === 0) issues.push(issueNotInEntry("pull-request/no-listing", "The pull request changes no file of a listing folder."));
  if (issues.length > 0) return { issues };
  return { folder: [...folders][0]! };
}

/** The base is trusted: a file that cannot be read is a failure of the CI, not an issue of the pull request. */
async function readBase<T>(source: PullRequestSource, path: string, read: (value: unknown) => T, absent: T): Promise<T> {
  const bytes = await source.file("base", path);
  if (!bytes) return absent;
  const value = parseJson(bytes);
  if (value === undefined) throw new Error(`The base ${path} is not valid UTF-8 JSON.`);
  return read(value);
}

/** The parsed JSON, or undefined when the bytes are not UTF-8 JSON. */
function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}

async function findRepository(source: PullRequestSource, json: unknown): Promise<GitHubFacts["source"]> {
  const url = typeof json === "object" && json !== null ? (json as Partial<Entry>).source : undefined;
  const match = typeof url === "string" ? GITHUB_SOURCE.exec(url) : null;
  return match ? source.repository(match[1]!, match[2]!) : null;
}

function decide(issues: Issue[], change: ChangeType | null): Decision {
  if (issues.length > 0) return "refuse";
  if (change === "new-module") return "approval";
  if (change === "new-version" || change === "metadata" || change === "withdrawal") return "merge";
  return "maintainer";
}

const SENTENCES: Record<Decision, string> = {
  merge: "This pull request passes the check and is merged automatically.",
  approval:
    "This pull request passes the check and awaits the Maintainer's Approval. The Approval is given once, at the Maintainer's sole discretion, and passing the check is no guarantee of it.",
  maintainer: "This pull request passes the check, but this change goes to the Maintainer.",
  refuse: "This pull request does not pass the check: fix the issues and push again.",
};

function renderComment(folder: string | null, issues: Issue[], decision: Decision, freeze: string | null): string {
  const subject = folder ? ` for ${code(`@${folder}`)}` : "";
  const lines = [MARKER, `## Marketplace check${subject}: ${decision}`, "", SENTENCES[decision]];
  if (freeze !== null) {
    lines.push("", `The GitHub account of the namespace ${code(`@${freeze}`)} changed since it was recorded: the Namespace is frozen, and the Maintainer is notified and decides.`);
  }
  if (issues.length > 0) {
    lines.push("");
    for (const found of issues) {
      const at = [found.version && `version ${code(found.version)}`, found.file && `file ${code(found.file)}`].filter(Boolean);
      lines.push(`- \`${found.code}\`: ${neutralise(found.message)}${at.length > 0 ? ` (${at.join(", ")})` : ""}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Text in a code span, which renders literally: no HTML, no mention. */
function code(text: string): string {
  return `\`${text.replaceAll("`", "'")}\``;
}

/** Text from the pull request, made inert in a Markdown comment: no HTML, no mention. */
function neutralise(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("@", `@${ZERO_WIDTH_SPACE}`);
}
