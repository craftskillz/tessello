// Where the Host keeps what must survive a reload. IndexedDB in the browser; in memory for the tests.

export interface Persistence {
  /** Every stored entry of a Module: key → serialized JSON value. */
  readStorage(moduleId: string): Promise<Map<string, string>>;
  writeStorage(moduleId: string, key: string, serialized: string): Promise<void>;
  deleteStorageKey(moduleId: string, key: string): Promise<void>;
}

export function createMemoryPersistence(): Persistence {
  const storages = new Map<string, Map<string, string>>();
  const storageOf = (moduleId: string) => {
    let storage = storages.get(moduleId);
    if (!storage) storages.set(moduleId, (storage = new Map()));
    return storage;
  };
  return {
    async readStorage(moduleId) {
      return new Map(storageOf(moduleId));
    },
    async writeStorage(moduleId, key, serialized) {
      storageOf(moduleId).set(key, serialized);
    },
    async deleteStorageKey(moduleId, key) {
      storageOf(moduleId).delete(key);
    },
  };
}
