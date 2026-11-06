import { existsSync } from "node:fs";
import { link, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** What `acquireLock` depends on from the outside world; tests replace both. */
export interface LockDeps {
  /** This process's PID. */
  pid: number;
  /** Whether a PID is a running process. */
  isRunning: (pid: number) => boolean;
}

/** Either we hold the lock, or someone else does (`pid` is 0 when it could not be read). */
export type Lock = { acquired: true; release: () => Promise<void> } | { acquired: false; pid: number };

/** Signal 0 checks existence without sending anything. EPERM means the process exists but belongs to someone else. */
function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readPid(file: string): Promise<number | null> {
  try {
    const pid = Number((await readFile(file, "utf8")).trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Takes `<root>/.tessello/sync.lock` so that two `tessello sync` never run on the same folder. The file holds the
 * PID of its owner; a lock whose PID no longer runs (or whose content is garbage) is stale and is taken over.
 * The caller guarantees that `.tessello/` exists.
 */
export async function acquireLock(root: string, deps: Partial<LockDeps> = {}): Promise<Lock> {
  const { pid, isRunning }: LockDeps = { pid: process.pid, isRunning: processIsRunning, ...deps };
  const file = join(root, ".tessello", "sync.lock");

  // Never delete a lock that another instance took over since: only remove it while it still holds our PID.
  const release = async (): Promise<void> => {
    if ((await readPid(file)) === pid) await rm(file, { force: true });
  };

  // The exclusive create is the atomic step: of two instances creating the lock, exactly one gets past it.
  const create = async (): Promise<boolean> => {
    try {
      await writeFile(file, `${pid}\n`, { flag: "wx" });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  };

  if (await create()) return { acquired: true, release };

  const holder = await readPid(file);
  if (holder !== null && isRunning(holder)) return { acquired: false, pid: holder };

  // Stale. Removing it by name could delete the fresh lock of an instance that took it over since we read it, so it
  // is moved aside first (atomic) and looked at: if what we moved is not the stale lock we judged, it goes back.
  const aside = `${file}.${pid}.stale`;
  try {
    await rename(file, aside);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (existsSync(aside)) {
    const moved = await readPid(aside);
    if (moved !== holder) {
      // `link` fails if yet another instance created a lock meanwhile: that one holds the folder either way.
      await link(aside, file).catch(() => {});
      await rm(aside, { force: true });
      return { acquired: false, pid: (await readPid(file)) ?? 0 };
    }
    await rm(aside, { force: true });
  }
  // A single try: if it loses, another instance won the takeover race and is the legitimate holder.
  if (await create()) return { acquired: true, release };
  return { acquired: false, pid: (await readPid(file)) ?? 0 };
}
