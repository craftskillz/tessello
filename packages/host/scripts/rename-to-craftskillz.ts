// One-off: moves what a Modules folder holds under the Maintainer's old Module IDs to the new ones, under @craftskillz
// (ADR 0016, v1 ticket 20). The Module ID is what ties a Module to its data (ADR 0003), so the registry, the data, the
// Home and the Manifest in the Module's folder all change together. It renames a Space export the same way.
//
// Close the Host first, then run, from the root of the repository:
//   node packages/host/scripts/rename-to-craftskillz.ts <Modules folder | export.zip>          dry run: lists the changes
//   node packages/host/scripts/rename-to-craftskillz.ts <Modules folder | export.zip> --apply  makes them
// An export is never overwritten: the renamed one is written next to it, as `<name>-craftskillz.zip`.

import { cp, mkdir, readdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/** Old Module ID → new Module ID. */
export const RENAMES: Record<string, string> = {
  "@tessello/diagram": "@craftskillz/diagram",
  "@craftskills/watch-later": "@craftskillz/watch-later",
  "@tessello/survival-kit": "@craftskillz/survival-kit",
  "@tessello/notes": "@craftskillz/notes",
  "@tessello/meteo": "@craftskillz/meteo",
  "@tessello/prometheus": "@craftskillz/prometheus",
};

const TESSELLO = ".tessello";
const REGISTRY = "modules.json";
const HOME = "home.json";
const DATA = "data";
const MANIFEST = "manifest.json";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const renamed = (id: string) => RENAMES[id] ?? id;

/** The parsed file, or null when it does not exist or is not JSON. */
async function readJson(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

/** The folder holds at least one entry. */
async function holdsSomething(path: string) {
  return readdir(path).then(
    (entries) => entries.length > 0,
    () => false,
  );
}

interface Change {
  /** What it changes, for the User to read. */
  description: string;
  /** The file it rewrites outside `.tessello/`, relative to the Modules folder, to keep a copy of. */
  rewrites?: string;
  apply(): Promise<void>;
}

export type RenameReport =
  /** A dry run: nothing was written. */
  | { status: "planned"; changes: string[] }
  /** `backup` is the hidden folder of the Modules folder holding the copy of what was there before. */
  | { status: "applied"; changes: string[]; backup: string }
  /** No old Module ID: nothing to do. */
  | { status: "unchanged" }
  /** These new Module IDs are already registered, hold data or are declared by a folder: nothing was written. */
  | { status: "conflict"; conflicts: string[] };

/** What renaming would change in the Modules folder at `root`, and the new Module IDs it would merge into existing ones. */
async function plan(root: string): Promise<{ changes: Change[]; conflicts: string[] }> {
  const tessello = join(root, TESSELLO);
  const changes: Change[] = [];

  const registry = await readJson(join(tessello, REGISTRY));
  const manifests: { folder: string; manifest: any }[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const manifest = await readJson(join(root, entry.name, MANIFEST));
    if (manifest) manifests.push({ folder: entry.name, manifest });
  }
  // A Module ID is in use when registered, holding data, or declared by a folder (ADR 0007).
  const known = new Set<string>([...(registry?.modules ?? []), ...manifests.map(({ manifest }) => manifest)].map(({ id }) => id));
  const inUse = async (id: string) => known.has(id) || (await holdsSomething(join(tessello, DATA, id)));
  const conflicts: string[] = [];
  for (const [from, to] of Object.entries(RENAMES)) {
    if ((await inUse(from)) && (await inUse(to))) conflicts.push(to);
  }
  for (const { id } of registry?.modules ?? []) {
    if (!RENAMES[id]) continue;
    // Rewriting the whole registry is the same whichever of its renamed Modules does it.
    changes.push({
      description: `registry: ${id} → ${RENAMES[id]}`,
      async apply() {
        for (const module of registry.modules) module.id = renamed(module.id);
        await writeFile(join(tessello, REGISTRY), json(registry));
      },
    });
  }

  const home = await readJson(join(tessello, HOME));
  for (const id of Array.isArray(home?.widgets) ? home.widgets : []) {
    if (!RENAMES[id]) continue;
    changes.push({
      description: `Home: ${id} → ${RENAMES[id]}`,
      async apply() {
        // A Module already on the Home under its new Module ID keeps its first place.
        home.widgets = [...new Set(home.widgets.map(renamed))];
        await writeFile(join(tessello, HOME), json(home));
      },
    });
  }

  for (const [from, to] of Object.entries(RENAMES)) {
    if (!(await holdsSomething(join(tessello, DATA, from)))) continue;
    changes.push({
      description: `data: ${TESSELLO}/${DATA}/${from} → ${TESSELLO}/${DATA}/${to}`,
      async apply() {
        await mkdir(join(tessello, DATA, to.split("/")[0]), { recursive: true });
        await rename(join(tessello, DATA, from), join(tessello, DATA, to));
        // The old namespace's folder, once empty, would be left for nothing.
        await rmdir(join(tessello, DATA, from.split("/")[0])).catch(() => {});
      },
    });
  }

  for (const { folder, manifest } of manifests) {
    if (!RENAMES[manifest.id]) continue;
    changes.push({
      description: `Manifest: ${folder}/${MANIFEST} → ${RENAMES[manifest.id]}`,
      rewrites: `${folder}/${MANIFEST}`,
      async apply() {
        manifest.id = RENAMES[manifest.id];
        await writeFile(join(root, folder, MANIFEST), json(manifest));
      },
    });
  }
  return { changes, conflicts };
}

/** "20261022-153000", in local time. */
const timestamp = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate(), "-", date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => (typeof part === "number" ? String(part).padStart(2, "0") : part))
    .join("");

/**
 * Renames the old Module IDs of the Modules folder at `root`. A dry run (`apply: false`) only says what would change.
 * Applied, it first copies `.tessello/` and the Manifests it rewrites into a hidden backup folder. It changes nothing
 * when a new Module ID is already in use (registered, holding data or declared by a folder): merging two Modules is
 * left to the User.
 */
export async function renameModulesFolder(root: string, { apply }: { apply: boolean }): Promise<RenameReport> {
  const { changes, conflicts } = await plan(root);
  if (conflicts.length > 0) return { status: "conflict", conflicts };
  if (changes.length === 0) return { status: "unchanged" };
  const descriptions = changes.map((change) => change.description);
  if (!apply) return { status: "planned", changes: descriptions };
  const backup = `${TESSELLO}-backup-${timestamp(new Date())}`;
  if (await holdsSomething(join(root, TESSELLO))) {
    await cp(join(root, TESSELLO), join(root, backup, TESSELLO), { recursive: true, errorOnExist: true, force: false });
  }
  for (const { rewrites } of changes) {
    if (rewrites) await cp(join(root, rewrites), join(root, backup, rewrites), { errorOnExist: true, force: false });
  }
  for (const change of changes) await change.apply();
  return { status: "applied", changes: descriptions, backup };
}

/** The description of the Space in an export (see host-core's space.ts), and the files of each Module under it. */
const SPACE_DESCRIPTION = "tessello-space.json";
const SPACE_MODULES = "modules/";

export type ExportRename =
  /** `file` is the renamed export; the one given is left as it was. */
  | { status: "renamed"; file: Uint8Array; changes: string[] }
  | { status: "unchanged" }
  /** The export already holds these new Module IDs. */
  | { status: "conflict"; conflicts: string[] };

/** Renames the old Module IDs of a Space export: its description, its Home and the Manifests of the Modules it holds. */
export function renameSpaceExport(file: Uint8Array): ExportRename {
  const entries = unzipSync(file);
  const description = JSON.parse(strFromU8(entries[SPACE_DESCRIPTION]));
  const modules: { id: string; folder: string }[] = description.modules;
  const ids = new Set(modules.map((module) => module.id));
  const conflicts = Object.entries(RENAMES).flatMap(([from, to]) => (ids.has(from) && ids.has(to) ? [to] : []));
  if (conflicts.length > 0) return { status: "conflict", conflicts };
  const changes: string[] = [];
  for (const module of modules) {
    const to = RENAMES[module.id];
    if (!to) continue;
    changes.push(`${module.id} → ${to}`);
    module.id = to;
    const path = `${SPACE_MODULES}${module.folder}/${MANIFEST}`;
    const manifest = JSON.parse(strFromU8(entries[path]));
    manifest.id = to;
    entries[path] = strToU8(json(manifest));
  }
  if (changes.length === 0) return { status: "unchanged" };
  description.home = description.home.map(renamed);
  entries[SPACE_DESCRIPTION] = strToU8(json(description));
  return { status: "renamed", file: zipSync(entries), changes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [target, ...flags] = process.argv.slice(2);
  if (!target || flags.some((flag) => flag !== "--apply")) {
    console.error("Usage: node packages/host/scripts/rename-to-craftskillz.ts <Modules folder | export.zip> [--apply]");
    process.exit(2);
  }
  const apply = flags.includes("--apply");
  if (target.endsWith(".zip")) {
    const result = renameSpaceExport(new Uint8Array(await readFile(target)));
    if (result.status === "conflict") {
      console.error(`Nothing written: the export already holds ${result.conflicts.join(", ")}.`);
      process.exit(1);
    }
    if (result.status === "unchanged") console.log("No old Module ID in this export: nothing to do.");
    else {
      for (const change of result.changes) console.log(change);
      const output = target.replace(/\.zip$/, "-craftskillz.zip");
      if (apply) await writeFile(output, result.file, { flag: "wx" });
      console.log(apply ? `Written to ${output}.` : `Dry run: nothing written. Run again with --apply to write ${output}.`);
    }
  } else {
    const report = await renameModulesFolder(target, { apply });
    if (report.status === "conflict") {
      console.error(`Nothing changed: ${report.conflicts.join(", ")} are already in use (registered, holding data or declared by a folder). Move or delete them first.`);
      process.exit(1);
    }
    if (report.status === "unchanged") console.log("No old Module ID in this Modules folder: nothing to do.");
    else {
      for (const change of report.changes) console.log(change);
      console.log(report.status === "applied" ? `Done. The previous state is kept in ${report.backup}.` : "Dry run: nothing changed. Run again with --apply.");
    }
  }
}
