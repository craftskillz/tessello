// Which Modules folder the Host uses (ADR 0007). Only the reference to the folder stays in the browser, in IndexedDB:
// if it is lost, choosing the same folder again finds everything, since the registry is in the folder itself. The
// reference and the permission to use the folder belong to the Host's origin.

// Not yet in TypeScript's DOM types.
declare global {
  interface Window {
    showDirectoryPicker?(options?: { id?: string; mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
    requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  }
}

const DATABASE = "tessello-host";
const STORE = "handles";
const KEY = "modules-folder";

/** Only Chrome and Edge on a computer let a page choose a folder. */
export const canUseFolders = () => typeof window.showDirectoryPicker === "function";

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Runs one request on the store, then closes the database, so that nothing keeps it open between visits. */
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

/** The folder chosen on a previous visit, if any. */
export async function rememberedFolder(): Promise<FileSystemDirectoryHandle | null> {
  return (await withStore("readonly", (store) => store.get(KEY))) ?? null;
}

export async function rememberFolder(folder: FileSystemDirectoryHandle): Promise<void> {
  await withStore("readwrite", (store) => store.put(folder, KEY));
}

/** Asks the User to pick a folder; null when they cancel. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker!({ id: "tessello-modules", mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

/** True when the Host may use the folder now; the browser may ask the User again at each visit. */
export const isGranted = async (folder: FileSystemDirectoryHandle) => (await folder.queryPermission({ mode: "readwrite" })) === "granted";

/** Asks the browser for the permission again: call it from a click. */
export const reconnect = async (folder: FileSystemDirectoryHandle) => (await folder.requestPermission({ mode: "readwrite" })) === "granted";

/** True when the folder already holds the registry of activated Modules, `.tessello/modules.json`. */
export async function hasTesselloFolder(folder: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await (await folder.getDirectoryHandle(".tessello")).getFileHandle("modules.json");
    return true;
  } catch {
    return false;
  }
}
