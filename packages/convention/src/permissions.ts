// Permissions (CONVENTION.md §3.1): parsing the declared origins and checking what they cover.

export const PERMISSION_NAMES: readonly string[] = ["network", "localNetwork"];

export interface Permissions {
  network?: string[];
  localNetwork?: string[];
}

interface OriginPattern {
  scheme: string;
  /** Host without the leading "*." when `wildcard` is true. */
  host: string;
  wildcard: boolean;
  port: string;
}

const ORIGIN_PATTERN = /^(https|wss|http|ws):\/\/(\*\.)?([a-z0-9.-]+|\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/i;
const DEFAULT_PORTS: Record<string, string> = { http: "80", ws: "80", https: "443", wss: "443" };
// An http(s) entry also allows the matching WebSocket scheme.
const SCHEME_FAMILY: Record<string, string> = { http: "http", ws: "http", https: "https", wss: "https" };

/** Parses a Permission entry, or returns null when it is not a well-formed origin. */
function parseOrigin(entry: string): OriginPattern | null {
  const match = ORIGIN_PATTERN.exec(entry);
  if (!match) return null;
  const [, scheme, wildcard, host, port] = match;
  const portNumber = port === undefined ? null : Number(port);
  if (portNumber !== null && (portNumber < 1 || portNumber > 65535)) return null;
  if (host!.startsWith(".") || host!.endsWith(".") || host!.includes("..")) return null;
  const lowerScheme = scheme!.toLowerCase();
  return {
    scheme: lowerScheme,
    host: host!.toLowerCase(),
    wildcard: wildcard !== undefined,
    port: port ?? DEFAULT_PORTS[lowerScheme]!,
  };
}

/** True for hosts on the User's machine or local network. */
export function isLocalHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "[::1]") return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Returns why an entry is invalid for its Permission, or null when it is valid.
 * Assumes `permission` is a known Permission name.
 */
export function invalidEntryReason(permission: string, entry: string): string | null {
  const origin = parseOrigin(entry);
  if (!origin) return "is not an origin such as \"https://api.example.com\" (scheme, host and optional port, no path or trailing \"/\")";
  if (permission === "network") {
    if (origin.scheme !== "https" && origin.scheme !== "wss") return "must use https:// or wss://";
    if (isLocalHost(origin.host)) return "is a local address; declare it in \"localNetwork\" instead";
    return null;
  }
  if (origin.wildcard) return "must not use a wildcard";
  if (!isLocalHost(origin.host)) return "is not a local address (localhost, loopback, private IPv4 or .local name)";
  return null;
}

/** True when `url`'s origin is covered by one of the declared entries. Malformed URLs are never covered. */
export function isCovered(url: string, entries: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const scheme = parsed.protocol.slice(0, -1);
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port || DEFAULT_PORTS[scheme];
  return entries.some((entry) => {
    const pattern = parseOrigin(entry);
    if (!pattern || SCHEME_FAMILY[pattern.scheme] !== SCHEME_FAMILY[scheme] || pattern.port !== port) return false;
    return pattern.wildcard ? host.endsWith(`.${pattern.host}`) : host === pattern.host;
  });
}
