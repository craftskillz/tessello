// The Host's persistence in the browser (ADR 0007): the Modules folder the User chose, through the File System Access
// API. Each Module is a top-level folder; `.tessello/` holds the registry, the layout of the Home and the storage of
// every Module, one indented JSON file per key.

import type { Persistence, RegisteredModule } from "@tessello/host-core";

const TESSELLO = ".tessello";
const REGISTRY = "modules.json";
const HOME = "home.json";
const DATA = "data";
/** Left out when reading a Module's files: a Creator's repository, and what archivers add. */
const IGNORED_FOLDERS = new Set([".git", "__MACOSX"]);
const IGNORED_FILES = new Set([".DS_Store"]);

const isMissing = (error: unknown) =>
  error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError");

/** The folder at `path` under `root`, created if `create`; null when it does not exist. */
async function folderAt(root: FileSystemDirectoryHandle, path: string[], create = false): Promise<FileSystemDirectoryHandle | null> {
  let folder = root;
  try {
    for (const name of path) folder = await folder.getDirectoryHandle(name, { create });
  } catch (error) {
    // A name such as ".." or "a/b" is a TypeError: it cannot be a file of the folder.
    if (isMissing(error) || error instanceof TypeError) return null;
    throw error;
  }
  return folder;
}

const bytesOf = async (file: FileSystemFileHandle) => new Uint8Array(await (await file.getFile()).arrayBuffer());

async function readBytes(folder: FileSystemDirectoryHandle, name: string): Promise<Uint8Array | null> {
  try {
    return await bytesOf(await folder.getFileHandle(name));
  } catch (error) {
    if (isMissing(error) || error instanceof TypeError) return null;
    throw error;
  }
}

/**
 * Writes a whole file. `createWritable()` writes to a temporary file that replaces the original only on `close()`,
 * so an interrupted write never leaves a file half written.
 */
async function writeFile(folder: FileSystemDirectoryHandle, name: string, content: string | Uint8Array): Promise<void> {
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  try {
    await writable.write(content as FileSystemWriteChunkType);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const SAFE = /^[a-z0-9_-]$/;
// Names Windows reserves, even with an extension: their first letter is escaped too.
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;
const MAX_NAME_BYTES = 200;

/**
 * The file name of a storage key. [a-z0-9_-] are kept and every other byte of the key's UTF-8 is escaped as %XX,
 * capitals included, so keys that differ only in case never share a file on a case-insensitive file system, and a
 * key such as "con" does not take a name Windows reserves. A long
 * name is cut and ends with a hash of the key, to stay under the 255 bytes of a file name. The file holds the exact
 * key, which is what listing the keys reads.
 */
export async function keyFileName(key: string): Promise<string> {
  const escaped = [...new TextEncoder().encode(key)]
    .map((byte) => {
      const char = String.fromCharCode(byte);
      return SAFE.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    })
    .join("")
    .replace(RESERVED, (name) => `%${name.charCodeAt(0).toString(16).toUpperCase()}${name.slice(1)}`);
  if (escaped.length <= MAX_NAME_BYTES) return `${escaped}.json`;
  let cut = MAX_NAME_BYTES;
  // Never in the middle of an escape.
  if (escaped[cut - 1] === "%") cut -= 1;
  else if (escaped[cut - 2] === "%") cut -= 2;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  const hash = [...digest.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  // "~" is always escaped in the rest of the name, so it only ever starts a hash.
  return `${escaped.slice(0, cut)}~${hash}.json`;
}

export function createFolderPersistence(root: FileSystemDirectoryHandle): Persistence {
  const tessello = () => folderAt(root, [TESSELLO], true) as Promise<FileSystemDirectoryHandle>;
  // A Module ID such as "@tessello/notes" is two folders: "@tessello" and "notes".
  const dataOf = (moduleId: string, create: boolean) => folderAt(root, [TESSELLO, DATA, ...moduleId.split("/")], create);

  return {
    registry: {
      async read() {
        const folder = await folderAt(root, [TESSELLO]);
        const bytes = folder && (await readBytes(folder, REGISTRY));
        if (!bytes) return [];
        const { modules } = JSON.parse(new TextDecoder().decode(bytes)) as { modules: RegisteredModule[] };
        return modules;
      },
      async write(modules) {
        await writeFile(await tessello(), REGISTRY, json({ modules }));
      },
    },
    home: {
      async read() {
        const folder = await folderAt(root, [TESSELLO]);
        const bytes = folder && (await readBytes(folder, HOME));
        if (!bytes) return [];
        // Edited by hand into something else, the layout is lost rather than the Home: the Widgets keep their default order.
        try {
          const { widgets } = JSON.parse(new TextDecoder().decode(bytes)) as { widgets: unknown };
          return Array.isArray(widgets) ? widgets.filter((id): id is string => typeof id === "string") : [];
        } catch {
          return [];
        }
      },
      async write(order) {
        await writeFile(await tessello(), HOME, json({ widgets: order }));
      },
    },
    folders: {
      async list() {
        const names: string[] = [];
        for await (const [name, handle] of root.entries()) {
          if (handle.kind === "directory" && !name.startsWith(".")) names.push(name);
        }
        return names.sort();
      },
      async readFile(folder, path) {
        const segments = path.split("/");
        const parent = await folderAt(root, [folder, ...segments.slice(0, -1)]);
        return parent && readBytes(parent, segments.at(-1)!);
      },
      async readFiles(folder) {
        const top = await folderAt(root, [folder]);
        if (!top) return null;
        const files = new Map<string, Uint8Array>();
        const walk = async (directory: FileSystemDirectoryHandle, prefix: string) => {
          for await (const [name, handle] of directory.entries()) {
            if (handle.kind === "directory") {
              if (!IGNORED_FOLDERS.has(name)) await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`);
            } else if (!IGNORED_FILES.has(name)) {
              files.set(prefix + name, await bytesOf(handle as FileSystemFileHandle));
            }
          }
        };
        await walk(top, "");
        return files;
      },
      async create(folder, files) {
        if (await folderAt(root, [folder])) throw new Error(`The folder "${folder}" already exists.`);
        for (const [path, bytes] of files) {
          const segments = path.split("/");
          const parent = (await folderAt(root, [folder, ...segments.slice(0, -1)], true))!;
          await writeFile(parent, segments.at(-1)!, bytes);
        }
      },
    },
    storage: {
      async read(moduleId) {
        const entries = new Map<string, string>();
        const folder = await dataOf(moduleId, false);
        if (!folder) return entries;
        for await (const [name, handle] of folder.entries()) {
          // Skips what is not a key's file, such as the temporary file of a write in progress.
          if (handle.kind !== "file" || !name.endsWith(".json")) continue;
          const { key, value } = JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text());
          entries.set(key, JSON.stringify(value));
        }
        return entries;
      },
      async write(moduleId, key, serialized) {
        await writeFile((await dataOf(moduleId, true))!, await keyFileName(key), json({ key, value: JSON.parse(serialized) }));
      },
      async delete(moduleId, key) {
        const folder = await dataOf(moduleId, false);
        try {
          await folder?.removeEntry(await keyFileName(key));
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      },
    },
  };
}

/**
 * Copies the Modules and `.tessello/` of a Modules folder into another one, leaving the first untouched. The registry
 * is copied last: a copy cut short leaves no `.tessello/modules.json`, so the target is not taken for a complete one.
 */
export async function copyModulesFolder(from: FileSystemDirectoryHandle, to: FileSystemDirectoryHandle): Promise<void> {
  const copy = async (source: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle, isTessello = false) => {
    for await (const [name, handle] of source.entries()) {
      if (isTessello && name === REGISTRY) continue;
      if (handle.kind === "directory") {
        await copy(handle as FileSystemDirectoryHandle, await target.getDirectoryHandle(name, { create: true }));
      } else {
        await writeFile(target, name, await bytesOf(handle as FileSystemFileHandle));
      }
    }
  };
  for await (const [name, handle] of from.entries()) {
    if (handle.kind !== "directory" || (name.startsWith(".") && name !== TESSELLO)) continue;
    await copy(handle as FileSystemDirectoryHandle, await to.getDirectoryHandle(name, { create: true }), name === TESSELLO);
  }
  const tessello = await folderAt(from, [TESSELLO]);
  const registry = tessello && (await readBytes(tessello, REGISTRY));
  if (registry) await writeFile((await folderAt(to, [TESSELLO], true))!, REGISTRY, registry);
}
