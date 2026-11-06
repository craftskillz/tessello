import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

const { acquireLock } = await import("../src/sync-lock.ts");

async function folder(): Promise<{ root: string; lock: string }> {
  const root = await mkdtemp(join(tmpdir(), "tessello-lock-"));
  await mkdir(join(root, ".tessello"));
  return { root, lock: join(root, ".tessello", "sync.lock") };
}

describe("sync lock", () => {
  test("acquire writes our PID and release removes the file", async () => {
    const { root, lock } = await folder();
    const result = await acquireLock(root, { pid: 4242, isRunning: () => true });
    assert.equal(result.acquired, true);
    assert.equal(await readFile(lock, "utf8"), "4242\n");
    if (result.acquired) await result.release();
    assert.equal(existsSync(lock), false);
  });

  test("a second acquire while the holder runs is refused with the holder's PID", async () => {
    const { root, lock } = await folder();
    await acquireLock(root, { pid: 100, isRunning: () => true });
    const second = await acquireLock(root, { pid: 200, isRunning: () => true });
    assert.deepEqual(second, { acquired: false, pid: 100 });
    assert.equal(await readFile(lock, "utf8"), "100\n");
  });

  test("a lock whose PID no longer runs is taken over", async () => {
    const { root, lock } = await folder();
    await writeFile(lock, "100\n");
    const result = await acquireLock(root, { pid: 200, isRunning: () => false });
    assert.equal(result.acquired, true);
    assert.equal(await readFile(lock, "utf8"), "200\n");
  });

  test("a garbage or empty lock file is taken over", async () => {
    for (const content of ["not a pid", "", "-5\n", "12.5\n"]) {
      const { root, lock } = await folder();
      await writeFile(lock, content);
      const result = await acquireLock(root, { pid: 200, isRunning: () => true });
      assert.equal(result.acquired, true, JSON.stringify(content));
      assert.equal(await readFile(lock, "utf8"), "200\n");
    }
  });

  test("release leaves a lock that another instance has taken over", async () => {
    const { root, lock } = await folder();
    const result = await acquireLock(root, { pid: 100, isRunning: () => true });
    await writeFile(lock, "300\n");
    if (result.acquired) await result.release();
    assert.equal(await readFile(lock, "utf8"), "300\n");
  });

  test("release twice does not throw", async () => {
    const { root, lock } = await folder();
    const result = await acquireLock(root, { pid: 100, isRunning: () => true });
    assert.equal(result.acquired, true);
    if (!result.acquired) return;
    await result.release();
    await result.release();
    assert.equal(existsSync(lock), false);
  });

  test("by default, a live PID holds the lock and a PID that cannot exist does not", async () => {
    const live = await folder();
    await writeFile(live.lock, `${process.pid}\n`);
    assert.deepEqual(await acquireLock(live.root, { pid: 1 }), { acquired: false, pid: process.pid });

    const dead = await folder();
    await writeFile(dead.lock, `${2 ** 22 + 12345}\n`);
    assert.equal((await acquireLock(dead.root, { pid: 1 })).acquired, true);
  });

  test("an instance that loses the takeover race leaves the winner's fresh lock in place", async () => {
    const { root, lock } = await folder();
    await writeFile(lock, "100\n");
    // Between our reading the stale PID 100 and our taking it over, instance 300 takes it over first.
    const isRunning = (pid: number) => {
      if (pid === 100) writeFileSync(lock, "300\n");
      return pid === 300;
    };
    const result = await acquireLock(root, { pid: 200, isRunning });
    assert.deepEqual(result, { acquired: false, pid: 300 });
    assert.equal(await readFile(lock, "utf8"), "300\n");
    assert.deepEqual((await readdir(join(root, ".tessello"))).sort(), ["sync.lock"]);
  });
});
