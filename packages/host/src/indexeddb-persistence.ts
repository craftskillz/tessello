// The Host's persistence in the browser (ADR 0002): installed Modules and their storage, in IndexedDB.

import type { InstalledModule, Persistence } from "@tessello/host-core";

const MODULES = "modules";
const STORAGE = "storage";

interface ModuleRecord {
  id: string;
  /** Keeps the Launcher in the order Modules were first installed. */
  installedAt: number;
  module: InstalledModule;
}

interface StorageRecord {
  moduleId: string;
  key: string;
  serialized: string;
}

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const committed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  });

export async function openIndexedDbPersistence(name = "tessello"): Promise<Persistence> {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore(MODULES, { keyPath: "id" });
    open.result.createObjectStore(STORAGE, { keyPath: ["moduleId", "key"] });
  };
  const db = await done(open);
  // Every key [moduleId, key] of one Module.
  const keysOf = (moduleId: string) => IDBKeyRange.bound([moduleId], [moduleId, []]);

  return {
    async listModules() {
      const records: ModuleRecord[] = await done(db.transaction(MODULES).objectStore(MODULES).getAll());
      return records.sort((a, b) => a.installedAt - b.installedAt).map((record) => record.module);
    },
    async putModule(module) {
      const transaction = db.transaction(MODULES, "readwrite");
      const store = transaction.objectStore(MODULES);
      const existing: ModuleRecord | undefined = await done(store.get(module.manifest.id));
      store.put({ id: module.manifest.id, installedAt: existing?.installedAt ?? Date.now(), module } satisfies ModuleRecord);
      await committed(transaction);
    },
    async readStorage(moduleId) {
      const records: StorageRecord[] = await done(db.transaction(STORAGE).objectStore(STORAGE).getAll(keysOf(moduleId)));
      return new Map(records.map((record) => [record.key, record.serialized]));
    },
    async writeStorage(moduleId, key, serialized) {
      const transaction = db.transaction(STORAGE, "readwrite");
      transaction.objectStore(STORAGE).put({ moduleId, key, serialized } satisfies StorageRecord);
      await committed(transaction);
    },
    async deleteStorageKey(moduleId, key) {
      const transaction = db.transaction(STORAGE, "readwrite");
      transaction.objectStore(STORAGE).delete([moduleId, key]);
      await committed(transaction);
    },
  };
}
