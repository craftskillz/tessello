// The Marketplace as the Host sees it (ADR 0015, 0017, 0018): the index it reads when the Marketplace screen opens, the
// copy it keeps for when the Marketplace cannot be reached, which packages are "from the Marketplace", and what the
// Host tells the User about the Modules installed from it.

import {
  compareVersions,
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

/**
 * What the Host tells the User about a Module installed from the Marketplace (ADR 0018). It only tells: nothing is
 * updated or uninstalled unless the User does it.
 */
export interface MarketplaceNotice {
  /** The Module ID. */
  id: string;
  /** The version installed, as the Marketplace lists it. */
  version: string;
  /** A release newer than the installed one, to offer; null when there is none, or the Module is banned or withdrawn. */
  update: IndexRelease | null;
  /**
   * The Ban of the Module (`module`, which a Ban of its Namespace also gives) or of the installed version (`version`),
   * with the Maintainer's reason. A banned version recommends the newest release, when there is a newer one.
   */
  ban: { scope: "module" | "version"; reason: string; recommended: IndexRelease | null } | null;
  /** The Creator withdrew the Module, or the installed version; null otherwise, and when a Ban says more. */
  withdrawal: { scope: "module" | "version" } | null;
}

/** How long the Host's start keeps to the copy of the index before downloading it again. */
const DAY_MS = 24 * 60 * 60 * 1000;

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
    /**
     * At the Host's start: downloads the index when a Module from the Marketplace is installed and the copy is a day
     * old or more. A Host with no such Module never reaches the Marketplace unless the User opens it.
     */
    async checkMarketplace(): Promise<void> {
      if (!options) return;
      if (!(await persistence.registry.read()).some((module) => module.provenance)) return;
      const copy = await persistence.marketplace.read();
      if (copy && now().getTime() - Date.parse(copy.receivedAt) < DAY_MS) return;
      await load();
    },
    /** What the copy of the index says of each Module installed from the Marketplace; nothing is downloaded. */
    async marketplaceNotices(): Promise<MarketplaceNotice[]> {
      const copy = await persistence.marketplace.read();
      if (!copy) return [];
      const notices: MarketplaceNotice[] = [];
      for (const { id, provenance } of await persistence.registry.read()) {
        if (!provenance) continue;
        const module = copy.index.modules.find((candidate) => candidate.id === id);
        if (!module) continue;
        const notice = noticeOf(module, provenance);
        if (notice.update || notice.ban || notice.withdrawal) notices.push(notice);
      }
      return notices;
    },
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

/** What the index says of a Module installed from it, as `provenance`: the installed version is found by its SHA-256. */
function noticeOf(module: IndexModule, provenance: Provenance): MarketplaceNotice {
  const notice: MarketplaceNotice = { id: module.id, version: provenance.version, update: null, ban: null, withdrawal: null };
  if (module.state === "banned") {
    notice.ban = { scope: "module", reason: module.reason ?? "", recommended: null };
    return notice;
  }
  if (module.state === "withdrawn") {
    notice.withdrawal = { scope: "module" };
    return notice;
  }
  const newer = module.latest && compareVersions(module.latest.version, provenance.version) > 0 ? module.latest : null;
  const installed = module.versions.find((version) => version.sha256 === provenance.sha256);
  if (installed?.banned !== undefined) notice.ban = { scope: "version", reason: installed.banned, recommended: newer };
  else if (installed?.withdrawn) notice.withdrawal = { scope: "version" };
  notice.update = newer;
  return notice;
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
