// The Marketplace as the Host sees it (ADR 0015, 0017, 0018): the index it reads when the Marketplace screen opens, the
// copy it keeps for when the Marketplace cannot be reached, and which packages are "from the Marketplace".

import {
  type IndexModule,
  type IndexRelease,
  type MarketplaceIndex,
  type SearchOptions,
  searchModules,
  sha256,
} from "@tessello/marketplace";
import type { MarketplaceCopy, Persistence, Provenance } from "./persistence.ts";

/** Where the Host downloads the index from; the browser fetches `index.json`, the tests use memory. */
export interface IndexSource {
  /** Downloads index.json; rejects when the Marketplace cannot be reached or answers something that is not an index. */
  fetch(): Promise<MarketplaceIndex>;
}

/** An index source in memory, with what the tests need to change it. */
export interface MemoryIndexSource extends IndexSource {
  /** What `fetch` answers; set it to publish another index. */
  index: MarketplaceIndex | undefined;
  /** While true, `fetch` rejects as when the User is offline. */
  offline: boolean;
  /** How many times `fetch` was called. */
  fetches: number;
}

/** An index source in memory that answers `index`, for the tests. */
export function createMemoryIndexSource(index?: MarketplaceIndex): MemoryIndexSource {
  const source: MemoryIndexSource = {
    index,
    offline: false,
    fetches: 0,
    async fetch() {
      source.fetches++;
      if (source.offline || !source.index) throw new Error("The Marketplace cannot be reached.");
      return structuredClone(source.index);
    },
  };
  return source;
}

/**
 * What the Marketplace screen shows: the index just downloaded (`online`), the last copy when the Marketplace cannot be
 * reached (`offline`, with the date of that copy), or nothing (`unavailable`: no access and no copy).
 */
export type MarketplaceReading =
  | {
      status: "online" | "offline";
      index: MarketplaceIndex;
      /** ISO 8601 date the Host received this index. */
      receivedAt: string;
      /** The Modules a User may find, by the Marketplace's own search and Permission filter. */
      search(options?: SearchOptions): IndexModule[];
    }
  | { status: "unavailable" };

export interface MarketplaceOptions {
  /** Where index.json is downloaded from. */
  source: IndexSource;
  /** For the tests; the system clock by default. */
  now?: () => Date;
}

/** The Marketplace of a Host: reading the index, keeping its copy, and the provenance of an install link's package. */
export function createMarketplace(persistence: Persistence, options?: MarketplaceOptions) {
  const now = options?.now ?? (() => new Date());

  /** The index just downloaded and kept, or the last copy; null when there is neither. */
  async function load(): Promise<{ online: boolean; copy: MarketplaceCopy } | null> {
    if (options) {
      try {
        const copy = { index: await options.source.fetch(), receivedAt: now().toISOString() };
        await persistence.marketplace.write(copy);
        return { online: true, copy };
      } catch {
        // Offline: the last copy does.
      }
    }
    const copy = await persistence.marketplace.read();
    return copy && { online: false, copy };
  }

  return {
    async readMarketplace(): Promise<MarketplaceReading> {
      const loaded = await load();
      if (!loaded) return { status: "unavailable" };
      const { index, receivedAt } = loaded.copy;
      return {
        status: loaded.online ? "online" : "offline",
        index,
        receivedAt,
        search: (searchOptions) => searchModules(index.modules, searchOptions),
      };
    },
    /**
     * The provenance of a package, when it is a version of the index: its SHA-256 is that of the version and, for an
     * install link, so is its URL. Banned versions do not count. The index is read only when a link is given.
     */
    async provenanceOfLink(zip: Uint8Array, url: string): Promise<Provenance | null> {
      const loaded = await load();
      if (!loaded) return null;
      const hash = await sha256(zip);
      for (const module of loaded.copy.index.modules) {
        if (module.state === "banned") continue;
        const found = module.versions.find((v) => v.sha256 === hash && v.url === url && v.banned === undefined);
        if (found) return { source: "marketplace", version: found.version, sha256: hash };
      }
      return null;
    },
  };
}

/**
 * Checks that the package downloaded for a release is the one the index lists (ADR 0018): the provenance it gets, or
 * the hash it has instead of the expected one.
 */
export async function checkRelease(
  release: IndexRelease,
  zip: Uint8Array,
): Promise<{ provenance: Provenance } | { mismatch: { expected: string; actual: string } }> {
  const actual = await sha256(zip);
  if (actual !== release.sha256) return { mismatch: { expected: release.sha256, actual } };
  return { provenance: { source: "marketplace", version: release.version, sha256: actual } };
}
