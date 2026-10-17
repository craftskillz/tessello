// Single source of truth for the numeric limits of the Convention (CONVENTION.md §11).
// Limits may be raised in a minor revision, never lowered within a Convention version.

const MB = 1024 * 1024;

export const SUPPORTED_CONVENTIONS: readonly number[] = [1];

export const LIMITS = {
  packageBytes: 10 * MB,
  storageValueBytes: 1 * MB,
  storageTotalBytes: 5 * MB,
  storageKeyLength: 256,
  openViewParamsBytes: 2 * 1024,
  handshakeTimeoutMs: 10_000,
  iconMinPngPixels: 256,
  nameMaxLength: 40,
  descriptionMaxLength: 200,
} as const;

export const WIDGET_SIZES: readonly string[] = ["S", "M", "L"];
