// Where the Host keeps what must survive a reload. IndexedDB in the browser; in memory for the tests.

import type { InstalledModule } from "./registry.ts";

export interface Persistence {
  /** Every installed Module, in the order they were first installed. */
  listModules(): Promise<InstalledModule[]>;
  /** Adds a Module, or replaces the one with the same ID. */
  putModule(module: InstalledModule): Promise<void>;
  /** Every stored entry of a Module: key → serialized JSON value. */
  readStorage(moduleId: string): Promise<Map<string, string>>;
  writeStorage(moduleId: string, key: string, serialized: string): Promise<void>;
  deleteStorageKey(moduleId: string, key: string): Promise<void>;
}

export function createMemoryPersistence(): Persistence {
  const modules = new Map<string, InstalledModule>();
  const storages = new Map<string, Map<string, string>>();
  const storageOf = (moduleId: string) => {
    let storage = storages.get(moduleId);
    if (!storage) storages.set(moduleId, (storage = new Map()));
    return storage;
  };
  return {
    async listModules() {
      return [...modules.values()];
    },
    async putModule(module) {
      modules.set(module.manifest.id, module);
    },
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
