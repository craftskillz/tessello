import { readZip } from "@tessello/convention";
import { checkPullRequest, parseEntry, sha256, type ChangedFile, type Decision, type Entry, type PullRequestSource } from "@tessello/marketplace";

/** Where the CLI reads GitHub: the REST API. Tests point it at a local server. */
export interface GitHubAccess {
  /** Default "https://api.github.com". */
  apiUrl: string;
  /** Sent as Bearer when present. */
  token?: string;
  /** Default: the global fetch. */
  fetch?: typeof fetch;
}

export const MARKETPLACE = "craftskillz/tessello-marketplace";
export const TERMS = "I have read PUBLISHING.md and accept its terms.";

export interface ListingRequest {
  zip: Uint8Array;
  /** Where the Creator published this exact .zip. */
  url: string;
  /** "owner/name". */
  marketplace: string;
  /** https://github.com/<owner>/<repo>: required for a new Module, must equal the listed one otherwise. */
  source?: string;
  /** For a new Module; default: the SPDX id GitHub reports for `source`. */
  license?: string;
  /** When given, replaces the tags. */
  tags?: string[];
  /** The GitHub account that will open the pull request, or null when unknown: Namespace ownership is then left to the CI. */
  author: { login: string; id: number } | null;
  github: GitHubAccess;
}

export interface Listing {
  /** "<namespace>/<name>". */
  folder: string;
  /** "modules/<namespace>/<name>/entry.json". */
  path: string;
  entry: Entry;
  /** JSON.stringify(entry, null, 2) + "\n". */
  json: string;
  change: "new-module" | "new-version";
  decision: Decision;
  version: string;
  notes: string[];
}

type Outcome = { ok: true; listing: Listing } | { ok: false; problems: string[] };

const GITHUB_SOURCE = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/;
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** Prepares the listing a pull request would carry, and checks it locally as the Marketplace CI will. Never throws for a Creator's mistake: returns the problems. */
export async function prepareListing(request: ListingRequest): Promise<Outcome> {
  const fail = (...problems: string[]): Outcome => ({ ok: false, problems });
  const doFetch = request.github.fetch ?? fetch;

  const { report } = readZip(request.zip);
  const errors = report.issues.filter((i) => i.severity === "error");
  if (errors.length > 0 || !report.manifest) return fail(...errors.map((i) => i.message));
  const { id, version } = report.manifest;
  const [namespace = "", name = ""] = id.slice(1).split("/");
  const folder = `${namespace}/${name}`;
  const path = `modules/${folder}/entry.json`;

  const hash = await sha256(request.zip);
  const hosted = await checkHosting(request.url, hash, doFetch);
  if (hosted) return fail(hosted);

  try {
    const api = githubReader(request.github, request.marketplace);
    const previousBytes = await api.raw(path);
    let entry: Entry;
    let change: Listing["change"];
    const listed = { version, url: request.url, sha256: hash };

    if (previousBytes === null) {
      change = "new-module";
      if (!request.source) return fail("This Module is not listed yet: pass --source https://github.com/<owner>/<repo>, the public repository of its source.");
      const match = GITHUB_SOURCE.exec(request.source);
      if (!match) return fail(`--source must be exactly https://github.com/<owner>/<repo>, got "${request.source}".`);
      const license = request.license ?? (await api.licenseOf(match[1]!, match[2]!));
      if (!license) return fail(`GitHub reports no license for ${request.source}: add one to the repository, or pass --license <SPDX identifier>.`);
      entry = { id, source: request.source, license, ...(request.tags && { tags: request.tags }), versions: [listed] };
    } else {
      change = "new-version";
      const parsed = parseEntry(JSON.parse(new TextDecoder().decode(previousBytes)));
      if (!parsed.entry) return fail(`The listing ${path} in ${request.marketplace} is not valid: ${parsed.issues.map((i) => i.message).join(" ")}`);
      const previous = parsed.entry;
      const existing = previous.versions.find((v) => v.version === version);
      if (existing) {
        return fail(existing.url === request.url && existing.sha256 === hash ? `Version ${version} of ${id} is already listed.` : `Version ${version} of ${id} is already listed with another package: a published version cannot change. Publish a new version instead.`);
      }
      if (request.source !== undefined && request.source !== previous.source) return fail(`${id} is listed with the source ${previous.source}: only the Maintainer changes it, by hand.`);
      if (request.license !== undefined && request.license !== previous.license) return fail(`${id} is listed with the license ${previous.license}: only the Maintainer changes it, by hand.`);
      entry = { ...previous, ...(request.tags && { tags: request.tags }), versions: [...previous.versions, listed] };
    }

    const json = `${JSON.stringify(entry, null, 2)}\n`;
    const notes: string[] = [];
    let author = request.author;
    if (!author) {
      const account = await api.account(namespace);
      author = { login: account?.login ?? namespace, id: account?.id ?? 0 };
      notes.push("Namespace ownership is checked by the CI: the GitHub account that opens the pull request is not known here.");
    }

    const check = await checkPullRequest({
      author,
      body: `- [x] ${TERMS}`,
      source: pullRequestSource({ api, path, json, downloads: new Map([[request.url, request.zip]]), doFetch }),
    });
    const issues = request.author ? check.issues : check.issues.filter((i) => !i.code.startsWith("namespace/not-owner"));
    if (issues.length > 0) return fail(...issues.map((i) => i.message));
    return { ok: true, listing: { folder, path, entry, json, change, decision: check.decision, version, notes } };
  } catch (error) {
    return fail(`Could not read GitHub: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The problem with the URL, or null when it serves exactly these bytes to any web page. */
async function checkHosting(url: string, hash: string, doFetch: typeof fetch): Promise<string | null> {
  let response: Response;
  let bytes: Uint8Array;
  try {
    response = await doFetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (response.status !== 200) {
      await response.body?.cancel();
      return `${url} answered ${response.status}: the package must be published there before it is listed.`;
    }
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    return `Could not download ${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
  if ((await sha256(bytes)) !== hash) return `${url} serves other bytes than this .zip: publish this exact file there.`;
  if (response.headers.get("access-control-allow-origin") !== "*") {
    return `${url} does not send the header "Access-Control-Allow-Origin: *", so the Host could not download it from a web page. GitHub Pages sends it; GitHub Releases does not.`;
  }
  return null;
}

interface Reader {
  /** The bytes of a file of the Marketplace's main branch, or null on 404. Read through the API, which is not cached like raw.githubusercontent.com. */
  raw(path: string): Promise<Uint8Array | null>;
  json(endpoint: string): Promise<any>;
  account(login: string): Promise<{ login: string; id: number; type: "User" | "Organization" } | null>;
  licenseOf(owner: string, name: string): Promise<string | null>;
  ok(endpoint: string): Promise<boolean>;
  repo: string;
}

function githubReader(access: GitHubAccess, marketplace: string): Reader {
  const doFetch = access.fetch ?? fetch;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "tessello-cli", ...(access.token && { Authorization: `Bearer ${access.token}` }) };
  /** The response, or null on 404. Any other failure throws. */
  const get = async (url: string, accept?: string): Promise<Response | null> => {
    const response = await doFetch(url, { headers: accept ? { ...headers, Accept: accept } : headers });
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) throw new Error(`GitHub answered ${response.status} to GET ${url}`);
    return response;
  };
  const json = async (endpoint: string) => (await get(`${access.apiUrl}${endpoint}`))?.json() ?? null;
  return {
    repo: `/repos/${marketplace}`,
    async raw(path) {
      const response = await get(`${access.apiUrl}/repos/${marketplace}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=main`, "application/vnd.github.raw+json");
      return response && new Uint8Array(await response.arrayBuffer());
    },
    json,
    async account(login) {
      const found = await json(`/users/${encodeURIComponent(login)}`);
      return found && { login: found.login, id: found.id, type: found.type === "Organization" ? "Organization" : "User" };
    },
    async licenseOf(owner, name) {
      const found = await json(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
      const license: string | undefined = found?.license?.spdx_id;
      return license && license !== "NOASSERTION" ? license : null;
    },
    async ok(endpoint) {
      try {
        const response = await doFetch(`${access.apiUrl}${endpoint}`, { headers });
        await response.body?.cancel();
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

/** The Marketplace's main branch as the base, and the same with the new entry.json as the head. */
function pullRequestSource(input: { api: Reader; path: string; json: string; downloads: Map<string, Uint8Array>; doFetch: typeof fetch }): PullRequestSource {
  const { api, path: listingPath, json, downloads } = input;
  const bytes = new TextEncoder().encode(json);
  const listingFolder = listingPath.slice(0, listingPath.lastIndexOf("/"));
  const contents = (folder: string) => `${api.repo}/contents/${folder.split("/").map(encodeURIComponent).join("/")}?ref=main`;
  return {
    async changedFiles(): Promise<ChangedFile[]> {
      return [{ path: listingPath }];
    },
    async file(side, path) {
      return side === "head" && path === listingPath ? bytes : api.raw(path);
    },
    async folder(side, path) {
      const found = await api.json(contents(path));
      const files = new Map<string, Uint8Array>();
      const others: string[] = [];
      for (const item of Array.isArray(found) ? found : []) {
        const content = item.type === "file" ? await api.raw(item.path) : null;
        if (content) files.set(item.name, content);
        else others.push(item.name);
      }
      if (side === "head" && path === listingFolder) files.set("entry.json", bytes);
      return { files, others };
    },
    account: (login) => api.account(login),
    isPublicMember: (organization, login) => api.ok(`/orgs/${encodeURIComponent(organization)}/public_members/${encodeURIComponent(login)}`),
    async isMaintainer(login) {
      const found = await api.json(`${api.repo}/collaborators/${encodeURIComponent(login)}/permission`).catch(() => null);
      return ["admin", "maintain", "write"].includes(found?.permission);
    },
    async repository(owner, name) {
      const found = await api.json(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
      if (!found) return null;
      const license: string | undefined = found.license?.spdx_id;
      return { private: found.private, license: license && license !== "NOASSERTION" ? license : null };
    },
    async download(url) {
      return downloads.get(url) ?? null;
    },
  };
}
