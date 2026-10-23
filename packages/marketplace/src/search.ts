// Kept apart from generator.ts so that the site script (and the Host) can use it without bundling the package readers.

import type { Permissions } from "@tessello/convention";
import type { IndexModule } from "./generator.ts";

/** The Permission filter: the Permissions the User accepts. Undefined accepts everything. */
export interface SearchOptions {
  query?: string;
  accepts?: readonly string[];
}

/**
 * The Modules a User may find: listed ones with a `latest`, matching every word of the query (case-insensitive,
 * split on whitespace) in their name, description, tags, creator or id, and the Permission filter. Index order kept.
 */
export function searchModules(modules: readonly IndexModule[], options: SearchOptions = {}): IndexModule[] {
  const words = (options.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const { accepts } = options;
  return modules.filter((module) => {
    const latest = module.latest;
    if (module.state !== "listed" || !latest) return false;
    if (accepts) {
      if (declaredPermissions(latest.permissions).some(([name]) => !accepts.includes(name))) return false;
    }
    const haystack = [latest.name, latest.description ?? "", ...module.tags, module.creator, module.id].join("\n").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** The Permissions a Module declares, with their origins; a Permission with an empty list is not declared. */
export function declaredPermissions(permissions: Permissions): [string, string[]][] {
  return Object.entries(permissions).filter((entry): entry is [string, string[]] => entry[1] !== undefined && entry[1].length > 0);
}
