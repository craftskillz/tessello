export type RemoteVisibility = "public" | "private" | "unknown";

const NAME = "([A-Za-z0-9._-]+)";
// The forms git accepts for a github.com remote. Names are limited to what GitHub allows so that nothing else
// (a path, a query, an encoded slash) can end up in the API URL.
const GITHUB_FORMS = [
  new RegExp(`^[A-Za-z0-9._-]+@github\\.com:${NAME}/${NAME}$`, "i"),
  new RegExp(`^ssh://[A-Za-z0-9._-]+@github\\.com(?::\\d+)?/${NAME}/${NAME}$`, "i"),
  new RegExp(`^https?://(?:[A-Za-z0-9._-]+@)?github\\.com/${NAME}/${NAME}$`, "i"),
];

/** owner/repo of a github.com remote, null for anything else. */
export function githubRepoOf(remote: string): { owner: string; repo: string } | null {
  const url = remote.trim().replace(/\/$/, "").replace(/\.git$/, "");
  for (const form of GITHUB_FORMS) {
    const match = form.exec(url);
    if (match) {
      const [, owner, repo] = match as unknown as [string, string, string];
      if (repo === "." || repo === ".." || owner === "." || owner === "..") return null;
      return { owner, repo };
    }
  }
  return null;
}

/** The part of fetch this needs. */
export type VisibilityFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

const TIMEOUT_MS = 10_000;
/** The anonymous API allows 60 requests an hour per IP: one check an hour is far below. */
const RECHECK_MS = 3_600_000;

/** One check. null when there was no HTTP answer (fetch rejected or timed out): offline. Non-github → "unknown" without calling fetch. */
export async function checkVisibility(remote: string, fetch: VisibilityFetch): Promise<RemoteVisibility | null> {
  const repo = githubRepoOf(remote);
  if (!repo) return "unknown";
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "tessello-sync" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  // Anonymous: a private repository answers 404, like a missing one, so only an explicit "not private" is public.
  if (response.status !== 200) return "unknown";
  try {
    const body = (await response.json()) as { private?: unknown } | null;
    return body !== null && typeof body === "object" && body.private === false ? "public" : "unknown";
  } catch {
    return "unknown";
  }
}

/** What the process remembers between rounds: which remote was last answered for, and when. Mutated by visibilityFor. */
export interface VisibilityMemo {
  remote?: string;
  checkedAt?: number;
}

/**
 * The value for this round. Checks only at startup (empty memo), when the remote changed, or an hour after the last
 * answer; otherwise returns `previous`. Offline keeps `previous` for the remote already answered for (or at startup),
 * but a changed remote gets "unknown": the old value says nothing of it. An offline check leaves the memo alone, so
 * the next round tries again.
 */
export async function visibilityFor(
  remote: string,
  previous: RemoteVisibility | undefined,
  memo: VisibilityMemo,
  now: Date,
  fetch: VisibilityFetch,
): Promise<RemoteVisibility | undefined> {
  const trimmed = remote.trim();
  if (trimmed === "") {
    // The value is dropped with the remote: setting it back must ask again, not return the missing value.
    delete memo.remote;
    delete memo.checkedAt;
    return undefined;
  }

  const answered = memo.remote !== undefined && memo.checkedAt !== undefined;
  const changed = answered && memo.remote !== trimmed;
  if (answered && !changed && now.getTime() - memo.checkedAt! < RECHECK_MS) return previous;

  const result = await checkVisibility(trimmed, fetch);
  if (result === null) return changed ? "unknown" : previous;
  memo.remote = trimmed;
  memo.checkedAt = now.getTime();
  return result;
}
