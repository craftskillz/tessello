// Installing a Module from a URL (ADR 0009): which URLs the Host downloads a package from, and the download itself,
// made directly from the browser with no proxy, and stopped beyond the package size limit.

import { type Issue, LIMITS } from "@tessello/convention";

export type UrlCheck = { status: "accepted"; url: string } | { status: "refused"; reason: string };

/**
 * Hosts a Creator serves their package from, over plain http:, while working on it. Deliberately narrower than the
 * convention's `isLocalHost`: ADR 0009 allows only these two, not local network addresses.
 */
const CREATOR_HOSTS = ["localhost", "127.0.0.1"];

/** Accepts https: URLs, and http: ones on a Creator's computer; refuses any other before a request is made. */
export function checkPackageUrl(text: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { status: "refused", reason: "This is not a URL. Paste the full address of the .zip file, starting with https://." };
  }
  if (url.username || url.password) {
    return { status: "refused", reason: "This URL contains a user name or password, which Tessello does not send. Use a public URL of the .zip file." };
  }
  if (url.protocol === "https:" || (url.protocol === "http:" && CREATOR_HOSTS.includes(url.hostname))) {
    return { status: "accepted", url: text.trim() };
  }
  return {
    status: "refused",
    reason: `Tessello downloads Modules only over https:, to be sure the file is the one its server sends. This URL uses ${url.protocol}. Only Creators testing on their computer may use http://localhost or http://127.0.0.1.`,
  };
}

export type Download =
  | { status: "downloaded"; bytes: Uint8Array }
  /** A network failure or a CORS refusal: the browser does not tell them apart (ADR 0009). */
  | { status: "unreachable" }
  /** The server answered, with an error status. */
  | { status: "failed"; httpStatus: number }
  | { status: "too-large"; issue: Issue };

export interface DownloadOptions {
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

const MB = 1024 * 1024;

const tooLarge = (): Download => ({
  status: "too-large",
  issue: {
    severity: "error",
    code: "package/too-large",
    message: `The file is larger than ${LIMITS.packageBytes / MB} MB, the limit of a package. Its download was stopped.`,
  },
});

/** Downloads a package from an accepted URL; stops as soon as it is known to exceed the package size limit. */
export async function downloadPackage(url: string, { fetch = globalThis.fetch, signal }: DownloadOptions = {}): Promise<Download> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof TypeError) return { status: "unreachable" };
    throw error;
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { status: "failed", httpStatus: response.status };
  }
  if (Number(response.headers.get("Content-Length")) > LIMITS.packageBytes) {
    await response.body?.cancel();
    return tooLarge();
  }
  // Content-Length may be missing or wrong: the bytes received are counted too.
  const chunks: Uint8Array[] = [];
  let received = 0;
  if (!response.body) return { status: "downloaded", bytes: new Uint8Array(0) };
  const reader = response.body.getReader();
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    received += chunk.value.byteLength;
    if (received > LIMITS.packageBytes) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { status: "downloaded", bytes };
}
