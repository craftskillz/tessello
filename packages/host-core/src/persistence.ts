// Where the Host keeps what must survive a reload: the User's Modules folder in the browser (ADR 0007), in memory for
// the tests.

import type { PackageFiles, Permissions } from "@tessello/convention";

/** A Module the User activated, as `.tessello/modules.json` records it. */
export interface RegisteredModule {
  id: string;
  /** The name of its folder in the Modules folder; only its Module ID identifies it. */
  folder: string;
  version: string;
  /** What the User granted: the CSP follows it, never the Manifest read again from disk. */
  permissions: Permissions;
}

export interface Persistence {
  /** `.tessello/modules.json`. */
  registry: {
    /** Every activated Module, in the order they were first activated. */
    read(): Promise<RegisteredModule[]>;
    write(modules: RegisteredModule[]): Promise<void>;
  };
  /** `.tessello/home.json`: the layout of the Home. */
  home: {
    /** The Module IDs of the Widgets, in the order the User arranged them; [] before the first arrangement. */
    read(): Promise<string[]>;
    write(order: string[]): Promise<void>;
  };
  /** The folders of the Modules folder, one per Module. */
  folders: {
    /** The names of the top-level folders, `.tessello/` and hidden folders left out. */
    list(): Promise<string[]>;
    /** One file of a folder, or null when the folder or the file does not exist. */
    readFile(folder: string, path: string): Promise<Uint8Array | null>;
    /** Every file of a folder (`.git/`, `__MACOSX/` and `.DS_Store` left out), or null when the folder does not exist. */
    readFiles(folder: string): Promise<PackageFiles | null>;
    /** Creates a folder holding these files. */
    create(folder: string, files: PackageFiles): Promise<void>;
  };
  /** The storage of each Module (CONVENTION.md §6.1), under `.tessello/data/<Module ID>/`. */
  storage: {
    /** Every stored entry of a Module: key → serialized JSON value. */
    read(moduleId: string): Promise<Map<string, string>>;
    write(moduleId: string, key: string, serialized: string): Promise<void>;
    delete(moduleId: string, key: string): Promise<void>;
  };
}

export interface MemoryPersistence extends Persistence {
  /** The Modules folder: folder name → path → content. Tests change it as a User would with their own tools. */
  disk: Map<string, Map<string, Uint8Array>>;
}

const IGNORED = /(^|\/)(\.git|__MACOSX)\/|(^|\/)\.DS_Store$/;

export function createMemoryPersistence(): MemoryPersistence {
  const disk = new Map<string, Map<string, Uint8Array>>();
  let registry: RegisteredModule[] = [];
  let home: string[] = [];
  const storages = new Map<string, Map<string, string>>();
  const storageOf = (moduleId: string) => {
    let storage = storages.get(moduleId);
    if (!storage) storages.set(moduleId, (storage = new Map()));
    return storage;
  };
  return {
    disk,
    registry: {
      async read() {
        return structuredClone(registry);
      },
      async write(modules) {
        registry = structuredClone(modules);
      },
    },
    home: {
      async read() {
        return [...home];
      },
      async write(order) {
        home = [...order];
      },
    },
    folders: {
      async list() {
        return [...disk.keys()].filter((name) => !name.startsWith(".")).sort();
      },
      async readFile(folder, path) {
        return disk.get(folder)?.get(path) ?? null;
      },
      async readFiles(folder) {
        const files = disk.get(folder);
        return files ? new Map([...files].filter(([path]) => !IGNORED.test(path))) : null;
      },
      async create(folder, files) {
        if (disk.has(folder)) throw new Error(`The folder "${folder}" already exists.`);
        disk.set(folder, new Map(files));
      },
    },
    storage: {
      async read(moduleId) {
        return new Map(storageOf(moduleId));
      },
      async write(moduleId, key, serialized) {
        storageOf(moduleId).set(key, serialized);
      },
      async delete(moduleId, key) {
        storageOf(moduleId).delete(key);
      },
    },
  };
}
