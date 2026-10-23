// Checks a Marketplace pull request through the GitHub REST API and writes the verdict for the workflow.
// Run with `node check-pull-request.ts --repository <owner/name> --pull-request <number> --out <dir>`, with GITHUB_TOKEN in the environment.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { checkPullRequest, type ChangedFile, type PullRequestCheck, type PullRequestSource } from "../src/index.ts";

export interface GitHubOptions {
  /** "owner/name" of the Marketplace repository. */
  repository: string;
  pullRequest: number;
  token: string;
  /** Default "https://api.github.com". */
  apiUrl?: string;
  fetch?: typeof fetch;
  /** Replaces the download of the packages, which only ever reads https URLs. For tests. */
  download?: (url: string) => Promise<Uint8Array | null>;
}

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const FILES_PER_PAGE = 100;

/** Reads the pull request from the GitHub REST API: its author, head sha, base branch and body, and a PullRequestSource over them. */
export async function openPullRequest(options: GitHubOptions): Promise<{ author: { login: string; id: number }; head: string; body: string; source: PullRequestSource }> {
  const api = options.apiUrl ?? "https://api.github.com";
  const doFetch = options.fetch ?? fetch;
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tessello-marketplace-check",
  };

  /** The response of a GET: null on 404, an Error on any other failure (the base is trusted: a failed CI is better than a wrong verdict). */
  const get = async (endpoint: string, accept?: string): Promise<Response | null> => {
    const response = await doFetch(`${api}${endpoint}`, { headers: accept ? { ...headers, Accept: accept } : headers });
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) throw new Error(`GitHub answered ${response.status} to GET ${endpoint}`);
    return response;
  };
  const getJson = async (endpoint: string): Promise<any> => (await get(endpoint))?.json() ?? null;

  const repo = `/repos/${options.repository}`;
  const pull = await getJson(`${repo}/pulls/${options.pullRequest}`);
  if (!pull) throw new Error(`Pull request ${options.pullRequest} not found in ${options.repository}.`);
  const head: string = pull.head.sha;
  const refs = { base: pull.base.ref as string, head };

  const contents = (side: "base" | "head", path: string) => `${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(refs[side])}`;

  /** The bytes of a regular file; null when absent or not a regular file. */
  const readFile = async (side: "base" | "head", path: string): Promise<Uint8Array | null> => {
    const endpoint = contents(side, path);
    const found = await getJson(endpoint);
    if (!found || Array.isArray(found) || found.type !== "file") return null;
    if (found.encoding === "base64" && found.content) return Uint8Array.from(Buffer.from(found.content, "base64"));
    // Over 1 MB the JSON carries no content: the raw media type returns the bytes.
    const raw = await get(endpoint, "application/vnd.github.raw+json");
    return raw ? new Uint8Array(await raw.arrayBuffer()) : null;
  };

  const source: PullRequestSource = {
    async changedFiles() {
      const changed: ChangedFile[] = [];
      for (let page = 1; ; page++) {
        const files: any[] = (await getJson(`${repo}/pulls/${options.pullRequest}/files?per_page=${FILES_PER_PAGE}&page=${page}`)) ?? [];
        for (const file of files) changed.push(file.previous_filename === undefined ? { path: file.filename } : { path: file.filename, previousPath: file.previous_filename });
        if (files.length < FILES_PER_PAGE) return changed;
      }
    },
    file: readFile,
    async folder(side, path) {
      const found = await getJson(contents(side, path));
      const files = new Map<string, Uint8Array>();
      const others: string[] = [];
      if (!Array.isArray(found)) return { files, others };
      for (const item of found) {
        const bytes = item.type === "file" ? await readFile(side, item.path) : null;
        if (bytes) files.set(item.name, bytes);
        else others.push(item.name);
      }
      return { files, others };
    },
    async account(login) {
      const found = await getJson(`/users/${encodeURIComponent(login)}`);
      return found && { login: found.login, id: found.id, type: found.type === "Organization" ? "Organization" : "User" };
    },
    async isPublicMember(organization, login) {
      return (await get(`/orgs/${encodeURIComponent(organization)}/public_members/${encodeURIComponent(login)}`)) !== null;
    },
    async isMaintainer(login) {
      const found = await getJson(`${repo}/collaborators/${encodeURIComponent(login)}/permission`);
      return ["admin", "maintain", "write"].includes(found?.permission);
    },
    async repository(owner, name) {
      const found = await getJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
      if (!found) return null;
      const license: string | undefined = found.license?.spdx_id;
      return { private: found.private, license: license && license !== "NOASSERTION" ? license : null };
    },
    download: options.download ?? ((url) => download(url, { fetch: doFetch })),
  };

  return { author: { login: pull.user.login, id: pull.user.id }, head, body: pull.body ?? "", source };
}

/** The bytes at an https URL, or null: not https, slower than 60 s, bigger than `maxBytes` (50 MB by default), or any failure. Sends no credentials. */
export async function download(url: string, options: { fetch?: typeof fetch; maxBytes?: number; timeoutMs?: number } = {}): Promise<Uint8Array | null> {
  const maxBytes = options.maxBytes ?? MAX_DOWNLOAD_BYTES;
  try {
    if (new URL(url).protocol !== "https:") return null;
    const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok || !response.body) return null;
    if (Number(response.headers.get("content-length")) > maxBytes) {
      await response.body.cancel();
      return null;
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > maxBytes) {
        await response.body.cancel();
        return null;
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/** Runs the check and writes result.json ({ decision, folder, change, head, namespace, freeze, issues }) and comment.md into `out`. Returns the check. */
export async function runCheck(options: GitHubOptions & { out: string }): Promise<PullRequestCheck> {
  const { author, head, body, source } = await openPullRequest(options);
  const check = await checkPullRequest({ author, body, source });
  await mkdir(options.out, { recursive: true });
  const { decision, folder, change, namespace, freeze, issues } = check;
  await writeFile(join(options.out, "result.json"), `${JSON.stringify({ decision, folder, change, head, namespace, freeze, issues }, null, 2)}\n`);
  await writeFile(join(options.out, "comment.md"), check.comment);
  return check;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { repository: { type: "string" }, "pull-request": { type: "string" }, out: { type: "string" } } });
  const pullRequest = Number(values["pull-request"]);
  const token = process.env.GITHUB_TOKEN;
  if (!values.repository || !values.out || !Number.isInteger(pullRequest) || pullRequest < 1 || !token) {
    console.error("Usage: check-pull-request.ts --repository <owner/name> --pull-request <number> --out <dir> (with GITHUB_TOKEN in the environment)");
    process.exit(2);
  }
  const apiUrl = process.env.GITHUB_API_URL;
  const check = await runCheck({ repository: values.repository, pullRequest, out: values.out, token, ...(apiUrl ? { apiUrl } : {}) });
  console.log(`Decision: ${check.decision} (${check.issues.length} issue${check.issues.length === 1 ? "" : "s"}).`);
}
