// The Marketplace index as the browser downloads it (ADR 0017): `index.json` from the Marketplace's address, whose asset
// paths (icons, guide images, screenshots) are relative to it.

import type { IndexSource, MarketplaceIndex } from "@tessello/host-core";

/**
 * Where the Host reads the Marketplace from. Provisional: the domain is settled by ticket 12 of tessello-v1. The tests
 * and a Maintainer's trials replace it with the `tessello.marketplace` entry of the browser's local storage.
 */
export const MARKETPLACE_INDEX_URL = "https://marketplace.tessello.app/index.json";

/** An asset of the Marketplace (an icon, a guide image, a screenshot) as a URL, from its path in the index. */
export const assetUrl = (indexUrl: string, path: string) => new URL(path, indexUrl).href;

/** The index downloaded from `url`; rejects when it cannot be reached or answers something that is not an index. */
export function createHttpIndexSource(url: string, fetch: typeof globalThis.fetch = globalThis.fetch): IndexSource {
  return {
    async fetch(): Promise<MarketplaceIndex> {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`The Marketplace answered ${response.status}.`);
      const index: unknown = await response.json();
      if (!isIndex(index)) throw new Error("The Marketplace answered something that is not an index.");
      return index;
    },
  };
}

function isIndex(value: unknown): value is MarketplaceIndex {
  if (typeof value !== "object" || value === null) return false;
  const index = value as { format?: unknown; modules?: unknown };
  return index.format === 1 && Array.isArray(index.modules);
}
