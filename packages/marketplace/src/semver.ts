/** Compares two semver versions by precedence: negative when `a` < `b`, positive when `a` > `b`, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const [coreA, preA] = splitPreRelease(a);
  const [coreB, preB] = splitPreRelease(b);
  const partsA = coreA.split(".").map(Number);
  const partsB = coreB.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (preA === undefined || preB === undefined) return preA === preB ? 0 : preA === undefined ? 1 : -1;
  const idsA = preA.split(".");
  const idsB = preB.split(".");
  for (let i = 0; i < Math.min(idsA.length, idsB.length); i++) {
    const diff = compareIdentifiers(idsA[i] as string, idsB[i] as string);
    if (diff !== 0) return diff;
  }
  return idsA.length - idsB.length;
}

/** Numeric identifiers compare numerically and rank below alphanumeric ones, which compare in ASCII order. */
function compareIdentifiers(a: string, b: string): number {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  if (numericA && numericB) return Number(a) - Number(b);
  if (numericA !== numericB) return numericA ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Splits "1.0.0-beta.1" at its first hyphen; the pre-release part may itself contain hyphens. */
function splitPreRelease(version: string): [string, string | undefined] {
  const at = version.indexOf("-");
  return at === -1 ? [version, undefined] : [version.slice(0, at), version.slice(at + 1)];
}
