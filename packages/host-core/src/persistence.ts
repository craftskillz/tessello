// Where the Host keeps what must survive a reload: the User's Modules folder in the browser (ADR 0007), in memory for
// the tests.

import type { PackageFiles, Permissions } from "@tessello/convention";
import type { MarketplaceIndex } from "@tessello/marketplace";

/**
 * Where a Module's package comes from when the Host can vouch for it. Only the Marketplace exists: a package whose
 * SHA-256 is that of a version of the Marketplace index (ADR 0018). A Module without provenance is local: it came from
 * the Modules folder, a `.zip` file, or a link whose package the index does not know.
 */
export interface Provenance {
  source: "marketplace";
  version: string;
  /** The SHA-256 of the package, lowercase hex, as the index lists it. */
  sha256: string;
}

/** The last index the Host received, kept for when the Marketplace cannot be reached. */
export interface MarketplaceCopy {
  index: MarketplaceIndex;
  /** ISO 8601 date the Host received it. */
  receivedAt: string;
}

/** A Module the User activated, as `.tessello/modules.json` records it. */
export interface RegisteredModule {
  id: string;
  /** The name of its folder in the Modules folder; only its Module ID identifies it. */
  folder: string;
  version: string;
  /** What the User granted: the CSP follows it, never the Manifest read again from disk. */
  permissions: Permissions;
  /** Absent for a local Module (ADR 0018). */
  provenance?: Provenance;
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
  /** `.tessello/marketplace.json`: the last copy of the Marketplace index. */
  marketplace: {
    /** The last copy received, or null before the first time the Marketplace was reached. */
    read(): Promise<MarketplaceCopy | null>;
    write(copy: MarketplaceCopy): Promise<void>;
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
    /**
     * Makes a folder hold these files and no other, created if it does not exist. What `readFiles` leaves out (`.git/`
     * for instance) stays.
     */
    replace(folder: string, files: PackageFiles): Promise<void>;
    /** Removes a folder and everything in it. */
    remove(folder: string): Promise<void>;
  };
  /** The storage of each Module (CONVENTION.md §6.1), under `.tessello/data/<Module ID>/`. */
  storage: {
    /** Every stored entry of a Module: key → serialized JSON value. */
    read(moduleId: string): Promise<Map<string, string>>;
    write(moduleId: string, key: string, serialized: string): Promise<void>;
    delete(moduleId: string, key: string): Promise<void>;
    /** Removes every stored entry of a Module. */
    clear(moduleId: string): Promise<void>;
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
  let marketplace: MarketplaceCopy | null = null;
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
    marketplace: {
      async read() {
        return structuredClone(marketplace);
      },
      async write(copy) {
        marketplace = structuredClone(copy);
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
      async replace(folder, files) {
        const kept = [...(disk.get(folder) ?? [])].filter(([path]) => IGNORED.test(path));
        disk.set(folder, new Map([...kept, ...files]));
      },
      async remove(folder) {
        disk.delete(folder);
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
      async clear(moduleId) {
        storages.delete(moduleId);
      },
    },
  };
}
