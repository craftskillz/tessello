// Export and import of the User's whole space in a single file (ADR 0002): the Modules (their Manifest and code), their
// data, the Permissions the User granted and the layout of the Home. Importing merges: a Module whose Module ID is
// already installed is left as it is, so nothing of the space is ever overwritten.

import {
  invalidEntryReason,
  LIMITS,
  type Manifest,
  type PackageFiles,
  PERMISSION_NAMES,
  type Permissions,
  validatePackage,
  type ValidationReport,
} from "@tessello/convention";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { HomeWidget } from "./home.ts";
import type { Icon } from "./modules.ts";
import type { Persistence, RegisteredModule } from "./persistence.ts";
import { storageProblem } from "./storage.ts";

/** The export: a `.zip` holding this description of the space, and each Module's files under `modules/<folder>/`. */
const DESCRIPTION = "tessello-space.json";
const MODULES = "modules/";
const FORMAT = "tessello-space";
const FORMAT_VERSION = 1;

interface ExportedModule extends RegisteredModule {
  /** Its storage: key → JSON value. */
  data: Record<string, unknown>;
}

interface Description {
  format: typeof FORMAT;
  version: typeof FORMAT_VERSION;
  /** In the order they were activated. */
  modules: ExportedModule[];
  /** The Module IDs of the Widgets, in the order the User arranged them. */
  home: string[];
}

export interface SpaceExport {
  /** The `.zip` file to save. */
  file: Uint8Array;
  /** The Module IDs of the registered Modules left out: no folder declares their Module ID any more. */
  missing: string[];
}

/** A Module of an export, as the User sees it before importing. */
export interface ImportedModule {
  manifest: Manifest;
  icon: Icon;
  /** The Permissions the User had granted it and its Manifest still declares, which importing grants again. */
  permissions: Permissions;
  /** The Validator's report: no error, but it may carry warnings. */
  report: ValidationReport;
  /** Its Module ID is already installed: importing leaves the installed Module, its code and its data as they are. */
  installed: boolean;
}

/** What the Host found in a file before the User decides to import it. */
export type SpaceInspection =
  /** Not an export, or one the Host cannot import whole: nothing is written. `report` is set when a Module fails the Validator. */
  | { status: "invalid"; problem: string; report?: ValidationReport }
  | {
      status: "valid";
      /** Every Module of the export, in the order they were activated. */
      modules: ImportedModule[];
      /**
       * Activates the Modules not installed yet, with their data, the Permissions granted and their place on the Home.
       * Declining is not calling it.
       */
      import(): Promise<void>;
    };

/** A file is refused with this problem. */
class Refused extends Error {
  report?: ValidationReport;
  constructor(problem: string, report?: ValidationReport) {
    super(problem);
    this.report = report;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A folder name every file system accepts: one segment, not hidden, none of the characters Windows refuses, no
 * trailing dot or space, and short enough to leave room for a suffix such as "-2".
 */
const FOLDER_NAME = /^[^.<>:"/\\|?*\u0000-\u001f](?:[^<>:"/\\|?*\u0000-\u001f]{0,198}[^<>:"/\\|?*\u0000-\u001f. ])?$/;

/**
 * The Permissions granted to an exported Module, as far as its Manifest declares them: an export changed by hand cannot
 * grant more than the Module asks for. A grant the Module no longer declares is dropped with it; it allowed nothing the
 * Module still uses.
 */
function checkPermissions(id: string, permissions: unknown, declared: Permissions = {}): Permissions {
  if (!isObject(permissions)) throw new Refused(`The Permissions granted to ${id} are not an object.`);
  for (const [name, entries] of Object.entries(permissions)) {
    if (!PERMISSION_NAMES.includes(name)) throw new Refused(`${id} was granted an unknown Permission "${name}".`);
    if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) {
      throw new Refused(`The Permission "${name}" granted to ${id} is not a list of origins.`);
    }
    for (const entry of entries) {
      const reason = invalidEntryReason(name, entry);
      if (reason) throw new Refused(`The Permission "${name}" granted to ${id}: "${entry}" ${reason}.`);
    }
  }
  const granted: Permissions = {};
  for (const name of PERMISSION_NAMES as (keyof Permissions)[]) {
    const entries = ((permissions as Permissions)[name] ?? []).filter((entry) => (declared[name] ?? []).includes(entry));
    if (entries.length > 0) granted[name] = entries;
  }
  return granted;
}

/** The storage of an exported Module, serialized as the Host stores it. */
function checkData(id: string, data: unknown): Map<string, string> {
  if (!isObject(data)) throw new Refused(`The data of ${id} is not an object.`);
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(data)) {
    if (value === null) throw new Refused(`The data of ${id} holds null for the key "${key}".`);
    entries.set(key, JSON.stringify(value));
  }
  const problem = storageProblem(entries);
  if (problem) throw new Refused(`The data of ${id}: ${problem}.`);
  return entries;
}

/** The description and the files of an export, checked whole: every Module passes the Validator again. */
/**
 * The largest an export of `modules` Modules may be once decompressed: each one's package, and its data with room for
 * the JSON around it, in the description.
 */
const maxExportBytes = (modules: number) => modules * (LIMITS.packageBytes + 2 * LIMITS.storageTotalBytes) + 1024 * 1024;

/** The files of an export, its declared sizes checked first so that an oversized archive is never decompressed. */
function unzip(file: Uint8Array): Record<string, Uint8Array> {
  const sizes = new Map<string, number>();
  try {
    unzipSync(file, {
      filter: (entry) => {
        sizes.set(entry.name, entry.originalSize);
        return false;
      },
    });
  } catch {
    throw new Refused("The file is not a readable .zip archive.");
  }
  const folders = new Map<string, number>();
  let total = 0;
  for (const [name, size] of sizes) {
    total += size;
    const folder = name.startsWith(MODULES) ? name.slice(MODULES.length).split("/")[0] : null;
    if (folder !== null) folders.set(folder, (folders.get(folder) ?? 0) + size);
  }
  if ([...folders.values()].some((size) => size > LIMITS.packageBytes) || total > maxExportBytes(folders.size)) {
    throw new Refused("The file is too large to be an export of Tessello.");
  }
  try {
    return unzipSync(file, { filter: (entry) => !entry.name.endsWith("/") });
  } catch {
    throw new Refused("The file is not a readable .zip archive.");
  }
}

function readExport(file: Uint8Array) {
  const entries = unzip(file);
  let description: unknown;
  try {
    description = JSON.parse(strFromU8(entries[DESCRIPTION] ?? new Uint8Array()));
  } catch {
    throw new Refused(`The file is not an export of Tessello: it holds no readable ${DESCRIPTION}.`);
  }
  if (!isObject(description) || description.format !== FORMAT) {
    throw new Refused(`The file is not an export of Tessello: ${DESCRIPTION} does not describe a space.`);
  }
  if (description.version !== FORMAT_VERSION) {
    throw new Refused("The file was exported by another version of Tessello, which this one cannot import.");
  }
  const { modules, home } = description;
  if (!Array.isArray(modules) || !Array.isArray(home) || !home.every((id) => typeof id === "string")) {
    throw new Refused(`${DESCRIPTION} is damaged: its list of Modules or its Home is missing.`);
  }
  const seen = new Set<string>();
  const checked = modules.map((module: unknown) => {
    if (!isObject(module) || typeof module.id !== "string" || typeof module.version !== "string") {
      throw new Refused(`${DESCRIPTION} is damaged: a Module has no Module ID or version.`);
    }
    const { id, folder, version } = module;
    if (seen.has(id)) throw new Refused(`${DESCRIPTION} is damaged: ${id} is there twice.`);
    seen.add(id);
    if (typeof folder !== "string" || !FOLDER_NAME.test(folder)) throw new Refused(`${DESCRIPTION} is damaged: ${id} has no valid folder name.`);
    const prefix = `${MODULES}${folder}/`;
    const files: PackageFiles = new Map(
      Object.entries(entries).flatMap(([path, bytes]) => (path.startsWith(prefix) ? [[path.slice(prefix.length), bytes]] : [])),
    );
    const report = validatePackage(files);
    if (!report.valid || !report.manifest) throw new Refused(`${id} does not comply with the Convention.`, report);
    const manifest = report.manifest;
    if (manifest.id !== id) throw new Refused(`${DESCRIPTION} is damaged: the folder of ${id} holds ${manifest.id}.`);
    return {
      registered: { id, folder, version, permissions: checkPermissions(id, module.permissions, manifest.permissions) },
      data: checkData(id, module.data),
      files,
      manifest,
      report,
    };
  });
  return { modules: checked, home: home as string[] };
}

export function createSpace(
  persistence: Persistence,
  modules: {
    /** The registered Module and its files on disk, or null when no folder declares its Module ID any more. */
    locate(id: string): Promise<{ module: RegisteredModule; files: PackageFiles } | null>;
    freeFolderName(name: string): Promise<string>;
  },
  /** The Widgets of the Home, in the order it shows them. */
  homeWidgets: () => Promise<HomeWidget[]>,
) {
  const { registry, home, folders, storage } = persistence;
  return {
    async exportSpace(): Promise<SpaceExport> {
      const exported: ExportedModule[] = [];
      const missing: string[] = [];
      const zipped: Record<string, Uint8Array> = {};
      for (const { id } of await registry.read()) {
        const found = await modules.locate(id);
        if (!found) {
          missing.push(id);
          continue;
        }
        const { module, files } = found;
        const data = Object.fromEntries([...(await storage.read(id))].map(([key, serialized]) => [key, JSON.parse(serialized)]));
        exported.push({ ...module, data });
        for (const [path, bytes] of files) zipped[`${MODULES}${module.folder}/${path}`] = bytes;
      }
      const description: Description = { format: FORMAT, version: FORMAT_VERSION, modules: exported, home: await home.read() };
      zipped[DESCRIPTION] = strToU8(`${JSON.stringify(description, null, 2)}\n`);
      return { file: zipSync(zipped), missing };
    },

    async inspectSpace(file: Uint8Array): Promise<SpaceInspection> {
      let space: ReturnType<typeof readExport>;
      try {
        space = readExport(file);
      } catch (error) {
        if (!(error instanceof Refused)) throw error;
        return { status: "invalid", problem: error.message, ...(error.report ? { report: error.report } : {}) };
      }
      const installed = new Set((await registry.read()).map((module) => module.id));
      return {
        status: "valid",
        modules: space.modules.map(({ registered, manifest, report, files }) => ({
          manifest,
          icon: { path: manifest.icon, bytes: files.get(manifest.icon)! },
          permissions: registered.permissions,
          report,
          installed: installed.has(registered.id),
        })),
        // Read again: a Module may have been installed since the User was shown the export.
        async import() {
          const registeredIds = new Set((await registry.read()).map((module) => module.id));
          const added: RegisteredModule[] = [];
          for (const { registered, files, data } of space.modules) {
            if (registeredIds.has(registered.id)) continue;
            const folder = await modules.freeFolderName(registered.folder);
            await folders.create(folder, files);
            await storage.clear(registered.id);
            for (const [key, serialized] of data) await storage.write(registered.id, key, serialized);
            added.push({ ...registered, folder });
          }
          // The imported Widgets go after those the Home shows, in the order they had: the order shown is saved first,
          // since a Home never arranged saves none.
          const addedIds = new Set(added.map((module) => module.id));
          const saved = await home.read();
          const shown = (await homeWidgets()).map((widget) => widget.id).filter((id) => !saved.includes(id));
          await home.write([...saved, ...shown, ...space.home.filter((id) => addedIds.has(id))]);
          // Registered last: an import cut short leaves folders to activate, not Modules without their data.
          await registry.write([...(await registry.read()), ...added]);
        },
      };
    },
  };
}
