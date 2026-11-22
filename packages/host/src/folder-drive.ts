// The folders the User grants Modules, in the browser (ADR 0022): chosen in the File System Access picker, their handles
// kept in IndexedDB of the Host's origin, as the Modules folder's is (modules-folder.ts). Chrome cannot move a folder:
// host-core moves its files one by one.

import { type Drive, type DriveEntry, type DriveFolder, ProtocolError } from "@tessello/host-core";

// Not yet in TypeScript's DOM types (Chrome 110+ on the local file system, for files only).
declare global {
  interface FileSystemFileHandle {
    move(destination: FileSystemDirectoryHandle, name: string): Promise<void>;
  }
}

const DATABASE = "tessello-folders";
const STORE = "grants";

const isMissing = (error: unknown) =>
  (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) ||
  error instanceof TypeError;

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Runs one request on the store, then closes the database. Each Module's grants are one entry: id → handle. */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const open = indexedDB.open(DATABASE, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE);
  const db = await done(open);
  try {
    return await done(run(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

type Grants = Map<string, FileSystemDirectoryHandle>;
const readGrants = async (moduleId: string): Promise<Grants> => (await withStore("readonly", (store) => store.get(moduleId))) ?? new Map();
const writeGrants = async (moduleId: string, grants: Grants) => {
  if (grants.size === 0) await withStore("readwrite", (store) => store.delete(moduleId));
  else await withStore("readwrite", (store) => store.put(grants, moduleId));
};

/** The folder at `path` under `root`, created if `create`; null when there is none. */
async function folderAt(root: FileSystemDirectoryHandle, path: string[], create = false) {
  let folder = root;
  try {
    for (const name of path) folder = await folder.getDirectoryHandle(name, { create });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return folder;
}

async function fileAt(root: FileSystemDirectoryHandle, path: string[]) {
  const parent = await folderAt(root, path.slice(0, -1));
  try {
    return parent && (await parent.getFileHandle(path.at(-1)!));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** One granted folder. */
export function driveFolder(handle: FileSystemDirectoryHandle): DriveFolder & { handle: FileSystemDirectoryHandle } {
  return {
    handle,
    name: handle.name,
    async state() {
      return (await handle.queryPermission({ mode: "readwrite" })) === "granted" ? "granted" : "prompt";
    },
    async reconnect() {
      return (await handle.requestPermission({ mode: "readwrite" })) === "granted" ? "granted" : "prompt";
    },
    isSame: (other) => handle.isSameEntry((other as ReturnType<typeof driveFolder>).handle),
    async contains(other) {
      return (await handle.resolve((other as ReturnType<typeof driveFolder>).handle)) !== null;
    },
    async read(path) {
      const file = await (await fileAt(handle, path))?.getFile();
      return file ? { bytes: new Uint8Array(await file.arrayBuffer()), lastModified: file.lastModified } : null;
    },
    async write(path, bytes) {
      const parent = (await folderAt(handle, path.slice(0, -1), true))!;
      const file = await parent.getFileHandle(path.at(-1)!, { create: true });
      const writable = await file.createWritable();
      await writable.write(bytes as Uint8Array<ArrayBuffer>);
      await writable.close();
      return (await file.getFile()).lastModified;
    },
    async kind(path) {
      if (path.length === 0) return "folder";
      if (await fileAt(handle, path)) return "file";
      return (await folderAt(handle, path)) ? "folder" : null;
    },
    async list(path) {
      const entries: DriveEntry[] = [];
      const walk = async (folder: FileSystemDirectoryHandle, at: string[]) => {
        for await (const [name, entry] of folder.entries()) {
          if (entry.kind === "directory") {
            entries.push({ kind: "folder", path: [...at, name] });
            await walk(entry as FileSystemDirectoryHandle, [...at, name]);
          } else {
            const file = await (entry as FileSystemFileHandle).getFile();
            entries.push({ kind: "file", path: [...at, name], lastModified: file.lastModified, size: file.size });
          }
        }
      };
      const top = await folderAt(handle, path);
      if (top) await walk(top, path);
      return entries;
    },
    async moveFile(from, to) {
      const file = (await fileAt(handle, from))!;
      const destination = (await folderAt(handle, to.slice(0, -1), true))!;
      await file.move(destination, to.at(-1)!);
    },
    async remove(path) {
      const parent = await folderAt(handle, path.slice(0, -1));
      await parent?.removeEntry(path.at(-1)!, { recursive: true });
    },
  };
}

export function createFolderDrive(): Drive {
  return {
    async pick() {
      try {
        return driveFolder(await window.showDirectoryPicker!({ mode: "readwrite" }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return null;
        if (error instanceof DOMException && (error.name === "SecurityError" || error.name === "NotAllowedError")) {
          throw new ProtocolError("not_allowed", "The browser opens the folder picker only from the User's click: send folders.request from it.");
        }
        throw error;
      }
    },
    grants: {
      async read(moduleId) {
        return new Map([...(await readGrants(moduleId))].map(([id, handle]) => [id, driveFolder(handle)]));
      },
      async write(moduleId, id, folder) {
        const grants = await readGrants(moduleId);
        grants.set(id, (folder as ReturnType<typeof driveFolder>).handle);
        await writeGrants(moduleId, grants);
      },
      async delete(moduleId, id) {
        const grants = await readGrants(moduleId);
        grants.delete(id);
        await writeGrants(moduleId, grants);
      },
    },
  };
}
