// The Modules of the User's Modules folder (CONVENTION.md §8, ADR 0007): finding them, activating them, and reading
// a Module's files when its View opens. A Module is identified by its Module ID, never by the name of its folder.

import { type Manifest, type PackageFiles, type Permissions, readZip, validatePackage, type ValidationReport } from "@tessello/convention";
import type { Persistence, RegisteredModule } from "./persistence.ts";

export interface Icon {
  path: string;
  bytes: Uint8Array;
}

/** A Module as the Launcher shows it. */
export interface ModuleEntry {
  /**
   * - `active`: registered, its folder is there;
   * - `new`: a folder the User has not activated yet;
   * - `conflict`: a folder declaring the Module ID of another, registered folder; it does not run;
   * - `missing`: registered, but no folder declares its Module ID any more.
   */
  status: "active" | "new" | "conflict" | "missing";
  /** For a `missing` Module, the folder it was last found in. */
  folder: string;
  /** Registered, or declared by the folder's Manifest; null when the Manifest gives none. */
  id: string | null;
  /** From the Manifest; the folder name or the Module ID when there is none. */
  name: string;
  icon: Icon | null;
}

/** What the Host knows about a Module before the User decides to activate it. */
export type Inspection =
  | { status: "invalid"; report: ValidationReport }
  /** Its Module ID is already registered, for the Module in `folder`. Updates come with ticket 07. */
  | { status: "conflict"; manifest: Manifest; folder: string }
  | {
      status: "valid";
      /** No error, but it may carry warnings. */
      report: ValidationReport;
      manifest: Manifest;
      icon: Icon;
      /** Activates the Module: it is registered with the Permissions its Manifest declares (ADR 0004). */
      install(): Promise<void>;
    };

/** What opening a Module's View finds, its files read again from disk. */
export type Opening =
  | {
      status: "ready";
      manifest: Manifest;
      files: PackageFiles;
      /** The Permissions the User granted, which the View's CSP follows. */
      permissions: Permissions;
    }
  /** Not registered, or no folder declares its Module ID any more. */
  | { status: "missing" }
  /** Its folder changed and no longer complies with the Convention. */
  | { status: "invalid"; report: ValidationReport }
  /**
   * Its Manifest declares Permissions the User has not granted: it does not run until they are accepted. Declining is
   * not calling `accept()`, and leaves the Module inactive with its storage intact.
   */
  | { status: "permissions"; manifest: Manifest; added: Permissions; accept(): Promise<void> };

const MANIFEST = "manifest.json";

const PERMISSION_NAMES = ["network", "localNetwork"] as const satisfies (keyof Permissions)[];

/** The Permissions of `declared` that `granted` does not hold. */
function addedPermissions(declared: Permissions = {}, granted: Permissions): Permissions {
  const added: Permissions = {};
  for (const name of PERMISSION_NAMES) {
    const entries = (declared[name] ?? []).filter((entry) => !(granted[name] ?? []).includes(entry));
    if (entries.length > 0) added[name] = entries;
  }
  return added;
}

const union = (a: Permissions, b: Permissions): Permissions => {
  const merged: Permissions = {};
  for (const name of PERMISSION_NAMES) {
    const entries = [...new Set([...(a[name] ?? []), ...(b[name] ?? [])])];
    if (entries.length > 0) merged[name] = entries;
  }
  return merged;
};

/** The fields of a Manifest that has not been validated, `{}` when it is not a JSON object. */
function looseManifest(bytes: Uint8Array | null): Record<string, unknown> {
  try {
    const parsed: unknown = bytes && JSON.parse(new TextDecoder().decode(bytes).replace(/^﻿/, ""));
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
  } catch {
    // Not JSON: the folder shows under its own name, and activating it shows the Validator's report.
  }
  return {};
}

const nonEmptyString = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);

/** Only what the Launcher needs from a Manifest that has not been validated: nothing in it can be trusted. */
interface Summary {
  id: string | null;
  name: string | null;
  icon: Icon | null;
}

export function createModules(persistence: Persistence) {
  const { folders, registry } = persistence;

  async function summaryOf(folder: string): Promise<Summary> {
    const manifest = looseManifest(await folders.readFile(folder, MANIFEST));
    const iconPath = nonEmptyString(manifest.icon);
    const iconBytes = iconPath === null ? null : await folders.readFile(folder, iconPath);
    return { id: nonEmptyString(manifest.id), name: nonEmptyString(manifest.name), icon: iconBytes && { path: iconPath!, bytes: iconBytes } };
  }

  /**
   * Reads the Manifest and the icon of every folder, and nothing else. A registered Module whose folder was renamed
   * or moved is found again by its Module ID, and the registry follows it.
   */
  async function scan(): Promise<ModuleEntry[]> {
    const names = await folders.list();
    const summaries = new Map(await Promise.all(names.map(async (name) => [name, await summaryOf(name)] as const)));
    const registered = await registry.read();
    const entries: ModuleEntry[] = [];
    const claimed = new Set<string>();
    let moved = false;
    for (const module of registered) {
      const candidates = names.filter((name) => !claimed.has(name) && summaries.get(name)!.id === module.id);
      const folder = candidates.includes(module.folder) ? module.folder : candidates[0];
      if (folder === undefined) {
        entries.push({ status: "missing", folder: module.folder, id: module.id, name: module.id, icon: null });
        continue;
      }
      claimed.add(folder);
      if (folder !== module.folder) {
        module.folder = folder;
        moved = true;
      }
      const summary = summaries.get(folder)!;
      entries.push({ status: "active", folder, id: module.id, name: summary.name ?? folder, icon: summary.icon });
    }
    if (moved) await registry.write(registered);
    for (const folder of names) {
      if (claimed.has(folder)) continue;
      const { id, name, icon } = summaries.get(folder)!;
      const status = id !== null && registered.some((module) => module.id === id) ? "conflict" : "new";
      entries.push({ status, folder, id, name: name ?? folder, icon });
    }
    return entries;
  }

  /** The Validator's verdict on the files of a Module; `activate` runs once the User confirms. */
  async function inspect(
    files: PackageFiles,
    activate: (manifest: Manifest) => Promise<void>,
    report = validatePackage(files),
  ): Promise<Inspection> {
    if (!report.valid || !report.manifest) return { status: "invalid", report };
    const manifest = report.manifest;
    const registered = (await registry.read()).find((module) => module.id === manifest.id);
    if (registered) return { status: "conflict", manifest, folder: registered.folder };
    return {
      status: "valid",
      report,
      manifest,
      icon: { path: manifest.icon, bytes: files.get(manifest.icon)! },
      install: () => activate(manifest),
    };
  }

  /** `name`, or `name-2`, `name-3`… when a folder or a registered Module already uses it. */
  async function freeFolderName(name: string): Promise<string> {
    const taken = new Set([...(await folders.list()), ...(await registry.read()).map((module) => module.folder)]);
    let candidate = name;
    for (let n = 2; taken.has(candidate); n++) candidate = `${name}-${n}`;
    return candidate;
  }

  async function addToRegistry(manifest: Manifest, folder: string) {
    const registered = await registry.read();
    registered.push({ id: manifest.id, folder, version: manifest.version, permissions: manifest.permissions ?? {} });
    await registry.write(registered);
  }

  /** Updates the registered Module with this ID, once read again. */
  async function update(id: string, change: (module: RegisteredModule) => void) {
    const registered = await registry.read();
    const module = registered.find((candidate) => candidate.id === id);
    if (!module) return;
    change(module);
    await registry.write(registered);
  }

  /** The registered Module and its files on disk, or null when its folder declares its Module ID no longer. */
  async function read(id: string): Promise<{ module: RegisteredModule; files: PackageFiles } | null> {
    const module = (await registry.read()).find((candidate) => candidate.id === id);
    if (!module) return null;
    const files = await folders.readFiles(module.folder);
    return files && nonEmptyString(looseManifest(files.get(MANIFEST) ?? null).id) === id ? { module, files } : null;
  }

  return {
    scan,
    /**
     * Reads a Module's files when its View opens and runs the Validator again: its folder may have changed since
     * (an editor, `git pull`). A new version updates the registry; added Permissions stop it.
     */
    async open(id: string): Promise<Opening> {
      // Not where it was registered: its folder may have been renamed, and scanning finds it again.
      const found = (await read(id)) ?? (await scan(), await read(id));
      if (!found) return { status: "missing" };
      const { module, files } = found;
      const report = validatePackage(files);
      if (!report.valid || !report.manifest) return { status: "invalid", report };
      const manifest = report.manifest;
      const added = addedPermissions(manifest.permissions, module.permissions);
      if (Object.keys(added).length > 0) {
        return {
          status: "permissions",
          manifest,
          added,
          accept: () =>
            update(id, (registered) => {
              registered.permissions = union(registered.permissions, added);
            }),
        };
      }
      if (manifest.version !== module.version) {
        await update(id, (registered) => {
          registered.version = manifest.version;
        });
      }
      return { status: "ready", manifest, files, permissions: module.permissions };
    },
    /** Checks a folder of the Modules folder with the Validator before activating it. */
    async inspectFolder(folder: string): Promise<Inspection> {
      const files = await folders.readFiles(folder);
      if (!files) throw new Error(`The folder "${folder}" does not exist.`);
      return inspect(files, (manifest) => addToRegistry(manifest, folder));
    },
    /** Checks a `.zip` package with the Validator; nothing is written until `install()` is called on a valid one. */
    async inspectZip(zip: Uint8Array): Promise<Inspection> {
      const { report, files } = readZip(zip);
      if (!files) return { status: "invalid", report };
      return inspect(
        files,
        async (manifest) => {
          const folder = await freeFolderName(manifest.id.slice(manifest.id.indexOf("/") + 1));
          await folders.create(folder, files);
          await addToRegistry(manifest, folder);
        },
        report,
      );
    },
  };
}
