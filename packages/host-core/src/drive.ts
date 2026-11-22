// The folders the User grants Modules, as the Host reaches them (ADR 0022): the File System Access API in the browser,
// in memory for the tests. The rules of the requests are in folders.ts; a Drive only does what it is told.

/** Whether the Host may use a folder now. After a browser restart, the User must allow it again. */
export type FolderState = "granted" | "prompt";

/** One folder the User chose in the picker. Paths are its own, as parts. */
export interface DriveFolder {
  readonly name: string;
  state(): Promise<FolderState>;
  /** Asks the browser to allow the folder again; needs the User's click. */
  reconnect(): Promise<FolderState>;
  /** True when both are the same folder on disk. */
  isSame(other: DriveFolder): Promise<boolean>;
  /** True when `other` is this folder or inside it. */
  contains(other: DriveFolder): Promise<boolean>;
  /** A file's content and when it was last modified (milliseconds), or null when there is no file at this path. */
  read(path: string[]): Promise<DriveFile | null>;
  /** Writes a file, creating it and its folders when needed; resolves with its new modification time. */
  write(path: string[], bytes: Uint8Array): Promise<number>;
  /** What is at a path, or null; the empty path is the folder itself. */
  kind(path: string[]): Promise<"file" | "folder" | null>;
  /** Every file and folder under a folder, at any depth, as paths from the granted folder. */
  list(path: string[]): Promise<DriveEntry[]>;
  /** Moves a file; the destination does not exist and its folders are created when needed. */
  moveFile(from: string[], to: string[]): Promise<void>;
  /** Removes a file, or a folder with everything in it. */
  remove(path: string[]): Promise<void>;
}

export type DriveEntry =
  | { kind: "file"; path: string[]; lastModified: number; size: number }
  | { kind: "folder"; path: string[] };

export interface DriveFile {
  bytes: Uint8Array;
  lastModified: number;
}

export interface Drive {
  /** Opens the folder picker; null when the User cancels. */
  pick(): Promise<DriveFolder | null>;
  /** The folders granted to each Module, kept across reloads: grant id → folder. */
  grants: {
    read(moduleId: string): Promise<Map<string, DriveFolder>>;
    write(moduleId: string, id: string, folder: DriveFolder): Promise<void>;
    delete(moduleId: string, id: string): Promise<void>;
  };
}

/** What a memory folder holds: path → content. */
export type MemoryFiles = Record<string, string | Uint8Array>;

/** A folder of the memory disk: a whole disk, or a folder inside one. */
export interface MemoryFolder extends DriveFolder {
  /** The files of its whole disk: path from the disk's top → content and modification time. */
  readonly disk: Map<string, DriveFile>;
  /** Its path on that disk, "" for the top. */
  readonly at: string;
}

export interface MemoryDrive extends Drive {
  /** A new disk on the test's machine, holding these files. */
  create(name: string, files?: MemoryFiles): MemoryFolder;
  /** A folder inside another one, such as `docs` in a repository. */
  inside(folder: MemoryFolder, path: string): MemoryFolder;
  /** What the next picker returns: a folder, or null as when the User cancels. */
  choose(folder: MemoryFolder | null): void;
  /** Changes the disk as another program would (an editor, an agent, git). */
  write(folder: MemoryFolder, path: string, content: string | Uint8Array): void;
  remove(folder: MemoryFolder, path: string): void;
  /** As after a browser restart: every folder waits for the User to allow it again. */
  restart(): void;
  /** The User refuses the next reconnections. */
  refuseReconnect(): void;
}

const bytes = (content: string | Uint8Array) => (typeof content === "string" ? new TextEncoder().encode(content) : content);
const join = (...parts: string[]) => parts.filter((part) => part !== "").join("/");

export function createMemoryDrive(): MemoryDrive {
  let chosen: MemoryFolder | null = null;
  // Every write is a millisecond later than the one before, so two writes never share a modification time.
  let clock = Date.now();
  const tick = () => ++clock;
  let restarted = false;
  let refusing = false;
  // The folders the User allowed again since the last restart, by their place on their disk.
  const allowed = new Set<string>();
  const disks = new WeakMap<Map<string, DriveFile>, string>();
  const placeOf = (folder: MemoryFolder) => `${disks.get(folder.disk)}:${folder.at}`;
  const granted = new Map<string, Map<string, DriveFolder>>();
  const grantsOf = (moduleId: string) => {
    let grants = granted.get(moduleId);
    if (!grants) granted.set(moduleId, (grants = new Map()));
    return grants;
  };

  const folderAt = (name: string, disk: Map<string, DriveFile>, at: string): MemoryFolder => {
    const key = (path: string[]) => join(at, ...path);
    const self: MemoryFolder = {
      name,
      disk,
      at,
      async state() {
        return !restarted || allowed.has(placeOf(self)) ? "granted" : "prompt";
      },
      async reconnect() {
        if (!refusing) allowed.add(placeOf(self));
        return self.state();
      },
      async isSame(other) {
        return (other as MemoryFolder).disk === disk && (other as MemoryFolder).at === at;
      },
      async contains(other) {
        const inner = other as MemoryFolder;
        return inner.disk === disk && (at === "" || inner.at === at || inner.at.startsWith(`${at}/`));
      },
      async read(path) {
        const file = disk.get(key(path));
        return file ? { bytes: file.bytes.slice(), lastModified: file.lastModified } : null;
      },
      async write(path, content) {
        const lastModified = tick();
        disk.set(key(path), { bytes: content.slice(), lastModified });
        return lastModified;
      },
      async kind(path) {
        const wanted = key(path);
        if (path.length > 0 && disk.has(wanted)) return "file";
        if (wanted === "") return "folder";
        return [...disk.keys()].some((each) => each.startsWith(`${wanted}/`)) ? "folder" : null;
      },
      async list(path) {
        const top = key(path);
        const prefix = top === "" ? "" : `${top}/`;
        const own = at === "" ? 0 : at.split("/").length;
        const entries: DriveEntry[] = [];
        const folders = new Set<string>();
        for (const [each, file] of disk) {
          if (!each.startsWith(prefix)) continue;
          const parts = each.split("/").slice(own);
          for (let depth = path.length + 1; depth < parts.length; depth++) folders.add(parts.slice(0, depth).join("/"));
          entries.push({ kind: "file", path: parts, lastModified: file.lastModified, size: file.bytes.byteLength });
        }
        for (const folder of folders) entries.push({ kind: "folder", path: folder.split("/") });
        return entries;
      },
      async moveFile(from, to) {
        const file = disk.get(key(from))!;
        disk.delete(key(from));
        disk.set(key(to), file);
      },
      async remove(path) {
        const wanted = key(path);
        for (const each of [...disk.keys()]) if (each === wanted || each.startsWith(`${wanted}/`)) disk.delete(each);
      },
    };
    return self;
  };

  return {
    create(name, files = {}) {
      const disk = new Map(Object.entries(files).map(([path, content]) => [path, { bytes: bytes(content), lastModified: tick() }]));
      disks.set(disk, crypto.randomUUID());
      return folderAt(name, disk, "");
    },
    inside(folder, path) {
      return folderAt(path.split("/").at(-1)!, folder.disk, join(folder.at, path));
    },
    choose(folder) {
      chosen = folder;
    },
    write(folder, path, content) {
      folder.disk.set(join(folder.at, path), { bytes: bytes(content), lastModified: tick() });
    },
    remove(folder, path) {
      folder.disk.delete(join(folder.at, path));
    },
    restart() {
      restarted = true;
      allowed.clear();
    },
    refuseReconnect() {
      refusing = true;
    },
    async pick() {
      return chosen;
    },
    grants: {
      async read(moduleId) {
        return new Map(grantsOf(moduleId));
      },
      async write(moduleId, id, folder) {
        grantsOf(moduleId).set(id, folder);
      },
      async delete(moduleId, id) {
        grantsOf(moduleId).delete(id);
      },
    },
  };
}
