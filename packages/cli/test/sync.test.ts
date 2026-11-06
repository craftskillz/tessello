import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, test } from "node:test";

// The tests must not depend on (or touch) the identity and settings of whoever runs them.
process.env.GIT_CONFIG_GLOBAL = join(await mkdtemp(join(tmpdir(), "tessello-gitconfig-")), "gitconfig");
await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
process.env.GIT_CONFIG_NOSYSTEM = "1";

const { keyFileName } = await import("../../host/src/folder-persistence.ts");
const { run } = await import("../src/cli.ts");
const { classifyPushFailure, intervalOf, syncLoop, syncOnce } = await import("../src/sync-command.ts");

const DATA = ".tessello/data";
const GIT_INTEGRATION = "@craftskillz/git-integration";
const NOTES = { id: "@craftskillz/notes", folder: "notes", name: "Notes" };
const TODO = { id: "@craftskillz/todo", folder: "todo", name: "Todo" };
const CONFIG = { remote: "", push: false, intervalSeconds: 60, dataModules: [NOTES.id] };

const NOW = new Date("2026-03-01T10:00:00.000Z");
const deps = { now: () => NOW };

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

async function put(dir: string, path: string, content: string): Promise<void> {
  await mkdir(join(dir, path, ".."), { recursive: true });
  await writeFile(join(dir, path), content);
}

/** A Modules folder as the Host leaves it: registry, Modules, their data and the config of Git Integration. */
async function modulesFolder(options: { config?: unknown; modules?: (typeof NOTES)[] } = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tessello-sync-"));
  const modules = options.modules ?? [NOTES, TODO];
  await put(dir, ".tessello/modules.json", json({ modules: modules.map((m) => ({ id: m.id, folder: m.folder, version: "1.0.0", permissions: [] })) }));
  for (const m of modules) {
    await put(dir, `${m.folder}/manifest.json`, json({ id: m.id, name: m.name }));
    await put(dir, `${DATA}/${m.id}/${await keyFileName("k")}`, json({ key: "k", value: m.id }));
  }
  if (options.config !== null) {
    await put(dir, `${DATA}/${GIT_INTEGRATION}/config.json`, json({ key: "config", value: options.config ?? CONFIG }));
  }
  return dir;
}

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
const tracked = (dir: string) => git(dir, "ls-files").split("\n").filter(Boolean);
const commitCount = (dir: string) => Number(git(dir, "rev-list", "--count", "HEAD").trim());

async function statusOf(dir: string) {
  return JSON.parse(await readFile(join(dir, DATA, GIT_INTEGRATION, "status.json"), "utf8")).value;
}

describe("tessello sync --once", () => {
  test("first round initialises the repository on main and commits, naming the Modules", async () => {
    const dir = await modulesFolder();
    const result = await syncOnce(dir, deps);

    assert.equal(result.committed, true);
    assert.equal(result.problem, undefined);
    assert.equal(git(dir, "symbolic-ref", "--short", "HEAD").trim(), "main");
    assert.equal(commitCount(dir), 1);
    assert.equal(git(dir, "log", "-1", "--format=%s").trim(), "tessello sync: @craftskillz/git-integration, @craftskillz/notes, @craftskillz/todo, registry");
    assert.equal(git(dir, "log", "-1", "--format=%ae").trim(), "sync@tessello.invalid");
    assert.deepEqual(result.status?.lastCommit?.modules, ["@craftskillz/git-integration", NOTES.id, TODO.id]);
    assert.equal(result.status?.lastCommit?.at, NOW.toISOString());
    assert.equal(result.status?.lastCommit?.sha, git(dir, "rev-parse", "--short", "HEAD").trim());
    assert.deepEqual(result.status?.installed, [NOTES, TODO]);
    assert.equal(result.status?.heartbeat, NOW.toISOString());
    assert.equal("problem" in result.status!, false);
  });

  test("uses the identity of the machine when there is one", async () => {
    const dir = await modulesFolder();
    git(dir, "init", "-b", "main");
    git(dir, "config", "user.email", "me@example.com");
    git(dir, "config", "user.name", "Me");
    await syncOnce(dir, deps);
    assert.equal(git(dir, "log", "-1", "--format=%ae").trim(), "me@example.com");
  });

  test("a round without changes commits nothing and keeps the last commit", async () => {
    const dir = await modulesFolder();
    const first = await syncOnce(dir, deps);
    const second = await syncOnce(dir, { now: () => new Date("2026-03-01T10:05:00.000Z") });

    assert.equal(second.committed, false);
    assert.equal(commitCount(dir), 1);
    assert.deepEqual(second.status?.lastCommit, first.status?.lastCommit);
    assert.equal(second.status?.heartbeat, "2026-03-01T10:05:00.000Z");
  });

  test("a change is committed under the name of its Module", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    await put(dir, `${DATA}/${NOTES.id}/${await keyFileName("k")}`, json({ key: "k", value: "changed" }));
    await put(dir, ".tessello/home.json", "{}\n");
    await syncOnce(dir, deps);
    assert.equal(git(dir, "log", "-1", "--format=%s").trim(), "tessello sync: @craftskillz/notes, home");
  });

  test("data of a Module that is not chosen is never committed", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    assert.ok(tracked(dir).includes(`${DATA}/${NOTES.id}/k.json`));
    assert.ok(!tracked(dir).some((p) => p.startsWith(`${DATA}/${TODO.id}/`)));
    assert.ok(tracked(dir).includes("todo/manifest.json"));
  });

  test("data of a Module that is not installed is not committed either", async () => {
    const dir = await modulesFolder();
    await put(dir, `${DATA}/@someone/stranger/k.json`, json({ key: "k", value: 1 }));
    await syncOnce(dir, deps);
    assert.ok(!tracked(dir).some((p) => p.includes("stranger")));
  });

  test("a Module removed from dataModules leaves the index but stays on disk", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    await put(dir, `${DATA}/${GIT_INTEGRATION}/config.json`, json({ key: "config", value: { ...CONFIG, dataModules: [] } }));
    const result = await syncOnce(dir, deps);

    assert.equal(result.committed, true);
    assert.ok(!tracked(dir).some((p) => p.startsWith(`${DATA}/${NOTES.id}/`)));
    assert.ok(existsSync(join(dir, DATA, NOTES.id, "k.json")));
  });

  test("a folder with its own repository is excluded and listed", async () => {
    const dir = await modulesFolder();
    await put(dir, "projects/readme.md", "mine");
    git(join(dir, "projects"), "init", "-b", "main").toString();
    const result = await syncOnce(dir, deps);

    assert.deepEqual(result.status?.ownRepositories, ["projects"]);
    assert.ok(!tracked(dir).some((p) => p.startsWith("projects/")));
  });

  test("a folder that becomes a repository later leaves the index", async () => {
    const dir = await modulesFolder();
    await put(dir, "projects/readme.md", "mine");
    await syncOnce(dir, deps);
    assert.ok(tracked(dir).includes("projects/readme.md"));
    git(join(dir, "projects"), "init", "-b", "main");
    await syncOnce(dir, deps);
    assert.ok(!tracked(dir).includes("projects/readme.md"));
  });

  test("a tracked file the User ignores later stays in the index: only the command's own exclusions untrack", async () => {
    const dir = await modulesFolder();
    await put(dir, "notes/build.log", "log");
    await syncOnce(dir, deps);
    await writeFile(join(dir, ".gitignore"), `*.log\n${await readFile(join(dir, ".gitignore"), "utf8")}`);
    await syncOnce(dir, deps);
    assert.ok(tracked(dir).includes("notes/build.log"));
  });

  test("a start marker left without its end is replaced, not repeated", async () => {
    const dir = await modulesFolder();
    await writeFile(join(dir, ".gitignore"), "mine\n# >>> tessello sync\n/stale/\n");
    await syncOnce(dir, deps);
    const text = await readFile(join(dir, ".gitignore"), "utf8");
    assert.ok(text.startsWith("mine\n# >>> tessello sync"));
    assert.equal(text.split("# >>> tessello sync").length, 2);
    assert.ok(!text.includes("/stale/"));
    assert.ok(text.endsWith("# <<< tessello sync\n"));
  });

  test("the lines of the User in .gitignore are kept across rounds", async () => {
    const dir = await modulesFolder();
    const mine = "node_modules/\n*.log";
    await writeFile(join(dir, ".gitignore"), mine);
    await syncOnce(dir, deps);
    await syncOnce(dir, deps);
    await writeFile(join(dir, ".gitignore"), (await readFile(join(dir, ".gitignore"), "utf8")).replace("*.log", "*.log\n# after"));
    await syncOnce(dir, deps);

    const text = await readFile(join(dir, ".gitignore"), "utf8");
    assert.ok(text.startsWith(mine));
    assert.ok(text.includes("# after"));
    assert.equal(text.split("# >>> tessello sync").length, 2);
    assert.equal(text.split("# <<< tessello sync").length, 2);
  });

  test("a missing config commits nothing and reports no-config", async () => {
    const dir = await modulesFolder({ config: null });
    const result = await syncOnce(dir, deps);

    assert.equal(result.problem, "no-config");
    assert.equal(result.committed, false);
    assert.equal(result.status?.problem?.kind, "no-config");
    assert.equal(result.status?.problem?.since, NOW.toISOString());
    assert.equal((await statusOf(dir)).problem.kind, "no-config");
  });

  test("an invalid config is no-config, and the problem keeps its start until it changes", async () => {
    const dir = await modulesFolder({ config: { remote: 3 } });
    await syncOnce(dir, deps);
    const later = await syncOnce(dir, { now: () => new Date("2026-03-01T11:00:00.000Z") });
    assert.equal(later.status?.problem?.since, NOW.toISOString());

    await writeFile(join(dir, DATA, GIT_INTEGRATION, "config.json"), "{ not json");
    assert.equal((await syncOnce(dir, deps)).problem, "no-config");
    await put(dir, `${DATA}/${GIT_INTEGRATION}/config.json`, json({ key: "other", value: CONFIG }));
    assert.equal((await syncOnce(dir, deps)).problem, "no-config");
  });

  test("a folder without .tessello/modules.json is not a Modules folder: nothing is written", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tessello-sync-"));
    const result = await syncOnce(dir, deps);

    assert.equal(result.problem, "not-a-modules-folder");
    assert.equal(result.status, null);
    assert.equal(existsSync(join(dir, ".git")), false);
    assert.equal(existsSync(join(dir, ".tessello")), false);
  });

  test("without git, the status carries git-missing and no repository is created", async () => {
    const dir = await modulesFolder();
    const result = await syncOnce(dir, { ...deps, git: "/nonexistent/git" });

    assert.equal(result.problem, "git-missing");
    assert.equal(result.status?.problem?.kind, "git-missing");
    assert.equal((await statusOf(dir)).problem.kind, "git-missing");
    assert.equal(existsSync(join(dir, ".git")), false);
  });

  test("an index.lock skips the commit without a problem but still beats the heart", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    await put(dir, `${DATA}/${NOTES.id}/k.json`, json({ key: "k", value: "changed" }));
    await put(dir, ".git/index.lock", "");
    const result = await syncOnce(dir, { now: () => new Date("2026-03-01T12:00:00.000Z") });

    assert.equal(result.committed, false);
    assert.equal(result.problem, undefined);
    assert.equal(commitCount(dir), 1);
    assert.equal((await statusOf(dir)).heartbeat, "2026-03-01T12:00:00.000Z");
  });

  test("the status is never committed, the config is", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    await syncOnce(dir, deps);
    assert.ok(existsSync(join(dir, DATA, GIT_INTEGRATION, "status.json")));
    assert.ok(tracked(dir).includes(`${DATA}/${GIT_INTEGRATION}/config.json`));
    assert.ok(!tracked(dir).some((p) => p.includes("status") || p.includes("tessello-sync-tmp")));
    assert.deepEqual(await readFile(join(dir, DATA, GIT_INTEGRATION, "status.json"), "utf8"), json({ key: "status", value: await statusOf(dir) }));
  });

  test("the file names are the ones the Host gives to the keys", async () => {
    assert.equal(await keyFileName("status"), "status.json");
    assert.equal(await keyFileName("config"), "config.json");
  });

  test("runs through the CLI: exit 0 when the round ran, 1 on a problem, 2 without --once", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const output = { out: (t: string) => out.push(t), err: (t: string) => err.push(t) };

    const good = await modulesFolder();
    assert.equal(await run(["sync", "--once", good], output, deps), 0);
    assert.equal(commitCount(good), 1);

    const bad = await mkdtemp(join(tmpdir(), "tessello-sync-"));
    assert.equal(await run(["sync", "--once", bad], output), 1);
    assert.match(err.join("\n"), /modules\.json/);

    err.length = 0;
    assert.equal(await run(["sync", "--once", "--bogus", good], output), 2);
    assert.match(err.join("\n"), /Usage: tessello sync/);
  });
});

describe("quiet period and interval", () => {
  const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);
  const dataFile = async () => `${DATA}/${NOTES.id}/${await keyFileName("k")}`;
  const touch = async (dir: string, path: string, when: Date) => utimes(join(dir, path), when, when);

  /** A folder already committed once, then with its Notes data rewritten and dated `ageMs` before NOW. */
  async function editedFolder(mtime: Date): Promise<{ dir: string; before: number }> {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    const path = await dataFile();
    await writeFile(join(dir, path), json({ key: "k", value: "edited" }));
    await touch(dir, path, mtime);
    return { dir, before: commitCount(dir) };
  }

  test("a file modified less than 10 s ago postpones the commit, the heartbeat is still written, the next round commits", async () => {
    const { dir, before } = await editedFolder(at(-5_000));
    const postponed = await syncOnce(dir, deps);

    assert.equal(postponed.committed, false);
    assert.equal(postponed.postponed, true);
    assert.equal(postponed.problem, undefined);
    assert.equal(commitCount(dir), before);
    assert.equal((await statusOf(dir)).heartbeat, NOW.toISOString());
    assert.equal((await statusOf(dir)).lastCommit.at, NOW.toISOString());

    const later = await syncOnce(dir, { now: () => at(20_000) });
    assert.equal(later.committed, true);
    assert.equal(later.postponed, undefined);
    assert.equal(commitCount(dir), before + 1);
  });

  test("a file dated more than 10 s in the future does not block commits", async () => {
    const { dir, before } = await editedFolder(at(60_000));
    const result = await syncOnce(dir, deps);
    assert.equal(result.committed, true);
    assert.equal(result.postponed, undefined);
    assert.equal(commitCount(dir), before + 1);
  });

  test("a file deleted just now does not postpone: the deletion is committed", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    await rm(join(dir, await dataFile()));
    const result = await syncOnce(dir, deps);
    assert.equal(result.committed, true);
    assert.equal(result.postponed, undefined);
  });

  /** A fresh Modules folder whose files are all dated an hour before `now` (the real clock). */
  async function agedFolder(now: Date): Promise<string> {
    const dir = await modulesFolder();
    const hourAgo = new Date(now.getTime() - 3_600_000);
    for (const path of [".tessello/modules.json", "notes/manifest.json", "todo/manifest.json", await dataFile(), `${DATA}/${TODO.id}/${await keyFileName("k")}`, `${DATA}/${GIT_INTEGRATION}/config.json`]) {
      await touch(dir, path, hourAgo);
    }
    return dir;
  }

  test("the .gitignore the round itself rewrites does not postpone the first round", async () => {
    const now = new Date();
    const dir = await agedFolder(now);
    const first = await syncOnce(dir, { now: () => now });
    assert.equal(first.committed, true);
    assert.equal(first.postponed, undefined);
  });

  test("a .gitignore the User has just edited, outside the command's section, does wait", async () => {
    const now = new Date();
    const dir = await agedFolder(now);
    await syncOnce(dir, { now: () => now });
    await writeFile(join(dir, ".gitignore"), `*.log\n${await readFile(join(dir, ".gitignore"), "utf8")}`);
    await touch(dir, ".gitignore", new Date(now.getTime() + 30_000 - 2_000));
    const result = await syncOnce(dir, { now: () => new Date(now.getTime() + 30_000) });
    assert.equal(result.committed, false);
    assert.equal(result.postponed, true);
  });

  test("intervalSeconds: 60 without a valid config, clamped to 10..3600, normal values pass through", async () => {
    assert.equal(intervalOf(null), 60);
    assert.equal(intervalOf({ ...CONFIG, intervalSeconds: 5 }), 10);
    assert.equal(intervalOf({ ...CONFIG, intervalSeconds: 99999 }), 3600);
    assert.equal(intervalOf({ ...CONFIG, intervalSeconds: 120 }), 120);
    assert.equal(intervalOf({ ...CONFIG, intervalSeconds: Number.NaN }), 60);

    const noConfig = await syncOnce(await modulesFolder({ config: null }), deps);
    assert.equal(noConfig.intervalSeconds, 60);
    const low = await syncOnce(await modulesFolder({ config: { ...CONFIG, intervalSeconds: 5 } }), deps);
    assert.equal(low.intervalSeconds, 10);
    const notModules = await syncOnce(await mkdtemp(join(tmpdir(), "tessello-sync-")), deps);
    assert.equal(notModules.intervalSeconds, 60);
  });
});

describe("tessello sync (continuous loop)", () => {
  /**
   * Drives syncLoop without sleeping: the fake sleep records the wait it was asked for, runs the hook of that round
   * (to change files or config between rounds), advances the clock and aborts after `rounds` rounds.
   */
  async function drive(dir: string, rounds: number, hooks: ((dir: string) => Promise<void>)[] = [], startMs = 0) {
    const controller = new AbortController();
    const sleeps: number[] = [];
    const log: string[] = [];
    let clock = NOW.getTime() + startMs;
    await syncLoop(dir, controller.signal, {
      now: () => new Date(clock),
      log: (line) => log.push(line),
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += 20_000;
        await hooks[sleeps.length - 1]?.(dir);
        if (sleeps.length >= rounds) controller.abort();
      },
    });
    return { sleeps, log };
  }
  const dataPath = async () => `${DATA}/${NOTES.id}/${await keyFileName("k")}`;

  test("a round postponed by the quiet period logs nothing, the next one logs its commit", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    const path = await dataPath();
    await writeFile(join(dir, path), json({ key: "k", value: "edited" }));
    const recent = new Date(NOW.getTime() - 5_000);
    await utimes(join(dir, path), recent, recent);

    const { log, sleeps } = await drive(dir, 2);

    assert.equal(sleeps.length, 2);
    assert.equal(log.length, 1);
    assert.match(log[0]!, /^2026-03-01T10:00:20\.000Z Committed [0-9a-f]+: @craftskillz\/notes$/);
  });

  test("a change of intervalSeconds between two rounds applies to the next sleep", async () => {
    const dir = await modulesFolder();
    const rewrite = async (d: string) =>
      put(d, `${DATA}/${GIT_INTEGRATION}/config.json`, json({ key: "config", value: { ...CONFIG, intervalSeconds: 30 } }));
    const { sleeps } = await drive(dir, 2, [rewrite]);
    assert.deepEqual(sleeps, [60_000, 30_000]);
  });

  test("an empty round logs nothing; a folder without config logs the message", async () => {
    const quiet = await modulesFolder();
    await syncOnce(quiet, deps);
    assert.deepEqual((await drive(quiet, 1)).log, []);

    const bare = await modulesFolder({ config: null });
    const { log } = await drive(bare, 1);
    assert.equal(log.length, 1);
    assert.match(log[0]!, /^2026-03-01T10:00:00\.000Z The Git Integration Module has not saved a valid configuration/);
  });

  test("a commit with no Module data is logged as such", async () => {
    const dir = await modulesFolder();
    await syncOnce(dir, deps);
    await writeFile(join(dir, ".tessello/home.json"), json({ pinned: [] }));
    const { log } = await drive(dir, 1);
    assert.match(log[0]!, / Committed [0-9a-f]+: no Module data$/);
  });

  test("a round that throws is logged and the loop keeps going with the default interval", async () => {
    const broken = await modulesFolder();
    // A git that starts but fails on everything else: `git init` throws inside the round.
    const fake = join(await mkdtemp(join(tmpdir(), "tessello-fakegit-")), "git");
    await writeFile(fake, '#!/bin/sh\n[ "$1" = "--version" ] && exit 0\necho boom >&2\nexit 1\n', { mode: 0o755 });
    const controller = new AbortController();
    const lines: string[] = [];
    const waits: number[] = [];
    await syncLoop(broken, controller.signal, {
      git: fake,
      now: () => NOW,
      log: (l) => lines.push(l),
      sleep: async (ms) => {
        waits.push(ms);
        if (waits.length >= 2) controller.abort();
      },
    });
    assert.deepEqual(waits, [60_000, 60_000]);
    assert.equal(lines.length, 2);
    assert.match(lines[0]!, /^2026-03-01T10:00:00\.000Z Round failed: git init failed: boom$/);
  });
});

describe("tessello sync (command, lock and signal)", () => {
  const lockPath = (dir: string) => join(dir, ".tessello", "sync.lock");
  function capture() {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, output: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
  }
  const continuous = (signal: AbortSignal, extra = {}) => ({ now: () => NOW, signal, sleep: async () => {}, ...extra });

  test("a live lock refuses --once and continuous mode, naming the PID, and is left untouched", async () => {
    const dir = await modulesFolder();
    await writeFile(lockPath(dir), `${process.pid}\n`);
    for (const args of [["--once", dir], [dir]]) {
      const { err, output } = capture();
      assert.equal(await run(["sync", ...args], output, continuous(AbortSignal.abort())), 1);
      assert.match(err.join("\n"), new RegExp(`Another tessello sync \\(PID ${process.pid}\\) is already running`));
    }
    assert.equal(existsSync(lockPath(dir)), true);
  });

  test("a stale lock is taken over and the lock file is gone afterwards, in both modes", async () => {
    for (const args of [["--once"], []]) {
      const dir = await modulesFolder();
      await writeFile(lockPath(dir), "999999\n");
      const { output } = capture();
      const code = await run(["sync", ...args, dir], output, continuous(AbortSignal.abort(), { lock: { isRunning: () => false } }));
      assert.equal(code, 0);
      assert.equal(existsSync(lockPath(dir)), false);
    }
  });

  test("an abort during the sleep stops the loop, returns 0, releases the lock and prints the log on out", async () => {
    const dir = await modulesFolder();
    const controller = new AbortController();
    const { out, output } = capture();
    const code = await run(["sync", dir], output, {
      now: () => NOW,
      signal: controller.signal,
      sleep: async () => {
        assert.equal(existsSync(lockPath(dir)), true);
        controller.abort();
      },
    });
    assert.equal(code, 0);
    assert.equal(existsSync(lockPath(dir)), false);
    assert.ok(out.some((line) => / Committed [0-9a-f]+: /.test(line)));
  });

  test("continuous mode on a folder that is not a Modules folder returns 1 and creates nothing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tessello-sync-"));
    const { err, output } = capture();
    assert.equal(await run(["sync", dir], output, continuous(AbortSignal.abort())), 1);
    assert.match(err.join("\n"), /is not a Modules folder/);
    assert.equal(existsSync(join(dir, ".tessello")), false);
  });
});

describe("push", () => {
  const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);
  const dataFile = async () => `${DATA}/${NOTES.id}/${await keyFileName("k")}`;
  const IDENTITY = ["-c", "user.name=x", "-c", "user.email=x@y"];

  async function bareRepo(): Promise<string> {
    const bare = await mkdtemp(join(tmpdir(), "tessello-bare-"));
    git(bare, "init", "--bare", "-b", "main");
    return bare;
  }
  const pushConfig = (remote: string, push = true) => ({ ...CONFIG, remote, push });
  async function pushingFolder(remote: string): Promise<string> {
    return modulesFolder({ config: pushConfig(remote) });
  }
  async function edit(dir: string, value: string): Promise<void> {
    const path = await dataFile();
    await writeFile(join(dir, path), json({ key: "k", value }));
    const old = new Date(NOW.getTime() - 3_600_000);
    await utimes(join(dir, path), old, old);
  }
  const head = (dir: string) => git(dir, "rev-parse", "HEAD").trim();
  const mainOf = (bare: string) => git(bare, "rev-parse", "main").trim();
  /** Another clone of `bare` that commits something and pushes it, as a second machine would. */
  async function pushElsewhere(bare: string): Promise<string> {
    const other = await mkdtemp(join(tmpdir(), "tessello-other-"));
    git(other, "clone", "-q", bare, ".");
    await writeFile(join(other, "elsewhere.txt"), "x");
    git(other, "add", "-A");
    git(other, ...IDENTITY, "commit", "-q", "-m", "elsewhere");
    git(other, "push", "-q", "origin", "main");
    return head(other);
  }

  test("the first push creates origin from the config and publishes main", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    const result = await syncOnce(dir, deps);

    assert.equal(result.pushed, true);
    assert.equal(result.problem, undefined);
    assert.equal(git(dir, "remote", "get-url", "origin").trim(), bare);
    assert.equal(mainOf(bare), head(dir));
    assert.equal(result.status?.lastPush?.at, NOW.toISOString());
    assert.equal("problem" in result.status!, false);
  });

  test("a following change is pushed; a round with nothing new pushes nothing and keeps lastPush", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    await syncOnce(dir, deps);
    await edit(dir, "second");
    const second = await syncOnce(dir, { now: () => at(60_000) });
    assert.equal(second.pushed, true);
    assert.equal(mainOf(bare), head(dir));
    assert.equal(second.status?.lastPush?.at, at(60_000).toISOString());

    const idle = await syncOnce(dir, { now: () => at(120_000) });
    assert.equal(idle.pushed, false);
    assert.equal(idle.problem, undefined);
    assert.equal(idle.status?.lastPush?.at, at(60_000).toISOString());
  });

  test("origin is corrected when it points elsewhere", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    git(dir, "init", "-b", "main");
    git(dir, "remote", "add", "origin", "/somewhere/else.git");
    await syncOnce(dir, deps);
    assert.equal(git(dir, "remote", "get-url", "origin").trim(), bare);
    assert.equal(mainOf(bare), head(dir));
  });

  test("a remote changed in the config receives main even when nothing new was committed", async () => {
    const first = await bareRepo();
    const dir = await pushingFolder(first);
    await syncOnce(dir, deps);
    const second = await bareRepo();
    await put(dir, `${DATA}/${GIT_INTEGRATION}/config.json`, json({ key: "config", value: pushConfig(second) }));
    const old = new Date(NOW.getTime() - 3_600_000);
    await utimes(join(dir, DATA, GIT_INTEGRATION, "config.json"), old, old);

    const result = await syncOnce(dir, deps);
    assert.equal(result.pushed, true);
    assert.equal(mainOf(second), head(dir));
  });

  test("a remote rewritten by url.insteadOf is not set again nor pushed again at every round", async () => {
    const bare = await bareRepo();
    const alias = `alias:${basename(bare)}`;
    const dir = await pushingFolder(alias);
    git(dir, "init", "-b", "main");
    git(dir, "config", `url.${dirname(bare)}/.insteadOf`, "alias:");
    assert.equal((await syncOnce(dir, deps)).pushed, true);
    const again = await syncOnce(dir, deps);
    assert.equal(again.pushed, false);
    assert.equal(again.problem, undefined);
    assert.equal(git(dir, "config", "--get", "remote.origin.url").trim(), alias);
  });

  test("an index.lock skips the push too, the next round pushes", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    await syncOnce(dir, deps);
    await edit(dir, "local");
    await syncOnce(dir, { now: () => new Date(NOW.getTime() + 60_000) });
    git(bare, "update-ref", "refs/heads/main", `${head(dir)}~1`);
    git(dir, "update-ref", "refs/remotes/origin/main", `${head(dir)}~1`);
    await put(dir, ".git/index.lock", "");
    assert.equal((await syncOnce(dir, deps)).pushed, false);
    assert.notEqual(mainOf(bare), head(dir));
    await rm(join(dir, ".git/index.lock"));
    assert.equal((await syncOnce(dir, deps)).pushed, true);
    assert.equal(mainOf(bare), head(dir));
  });

  test("a refused push is a problem kept across rounds, never forced; commits continue locally", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    await syncOnce(dir, deps);
    const elsewhere = await pushElsewhere(bare);

    await edit(dir, "local");
    const first = await syncOnce(dir, { now: () => at(60_000) });
    assert.equal(first.committed, true);
    assert.equal(first.pushed, false);
    assert.equal(first.problem, "push-rejected");
    assert.match(first.message!, /^git push failed: .*rejected/s);
    assert.ok(!first.message!.includes("hint:"));
    assert.equal(first.status?.problem?.since, at(60_000).toISOString());

    await edit(dir, "local again");
    const second = await syncOnce(dir, { now: () => at(120_000) });
    assert.equal(second.committed, true);
    assert.equal(second.problem, "push-rejected");
    assert.equal(second.status?.problem?.since, at(60_000).toISOString());
    assert.equal(mainOf(bare), elsewhere);
  });

  test("back to normal once the conflict is resolved by hand", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    await syncOnce(dir, deps);
    await pushElsewhere(bare);
    await edit(dir, "local");
    assert.equal((await syncOnce(dir, { now: () => at(60_000) })).problem, "push-rejected");

    git(dir, ...IDENTITY, "pull", "--no-rebase", "--no-edit", "origin", "main");
    const fixed = await syncOnce(dir, { now: () => at(120_000) });
    assert.equal(fixed.pushed, true);
    assert.equal(fixed.problem, undefined);
    assert.equal("problem" in fixed.status!, false);
    assert.equal(fixed.status?.lastPush?.at, at(120_000).toISOString());
    assert.equal(mainOf(bare), head(dir));
  });

  test("push disabled, or an empty remote: no origin, nothing pushed", async () => {
    const bare = await bareRepo();
    const off = await modulesFolder({ config: pushConfig(bare, false) });
    const result = await syncOnce(off, deps);
    assert.equal(result.pushed, false);
    assert.equal(git(off, "remote").trim(), "");
    assert.equal(git(bare, "branch", "--list").trim(), "");

    const empty = await modulesFolder({ config: pushConfig("  ") });
    const none = await syncOnce(empty, deps);
    assert.equal(none.pushed, false);
    assert.equal(none.problem, undefined);
    assert.equal(git(empty, "remote").trim(), "");
  });

  test("a push is retried when the round's commit is postponed by the quiet period", async () => {
    const bare = await bareRepo();
    const dir = await pushingFolder(bare);
    await syncOnce(dir, deps);
    await pushElsewhere(bare);
    await edit(dir, "local");
    await syncOnce(dir, { now: () => at(60_000) });
    git(dir, ...IDENTITY, "pull", "--no-rebase", "--no-edit", "origin", "main");

    const path = await dataFile();
    await writeFile(join(dir, path), json({ key: "k", value: "being written" }));
    const now = new Date();
    await utimes(join(dir, path), now, now);
    const result = await syncOnce(dir, { now: () => now });
    assert.equal(result.postponed, true);
    assert.equal(result.pushed, true);
    assert.equal(mainOf(bare), head(dir));
  });

  test("a remote asking for credentials is an auth problem and does not block", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="x"' });
      res.end();
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    try {
      const { port } = server.address() as { port: number };
      const dir = await pushingFolder(`http://127.0.0.1:${port}/repo.git`);
      const result = await syncOnce(dir, deps);
      assert.equal(result.problem, "auth");
      assert.equal(result.committed, true);
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });

  test("an unreachable remote is remote-unreachable", async () => {
    for (const remote of ["/nonexistent/tessello-remote.git", "http://127.0.0.1:1/x.git"]) {
      const result = await syncOnce(await pushingFolder(remote), deps);
      assert.equal(result.problem, "remote-unreachable");
      assert.equal(result.pushed, false);
    }
  });

  test("classifyPushFailure reads git's output", () => {
    const cases: [string, string][] = [
      [" ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs", "push-rejected"],
      [" ! [rejected]        main -> main (non-fast-forward)", "push-rejected"],
      ["Updates were rejected because the remote contains work", "push-rejected"],
      ["git@github.com: Permission denied (publickey).", "auth"],
      ["remote: Invalid username or password.\nfatal: Authentication failed for 'https://x/y.git/'", "auth"],
      ["fatal: could not read Username for 'https://x': terminal prompts disabled", "auth"],
      ["fatal: unable to access 'https://x/': The requested URL returned error: 403", "auth"],
      ["ERROR: Repository not found.", "auth"],
      ["fatal: Could not resolve host: example.invalid", "remote-unreachable"],
      ["ssh: connect to host x port 22: Connection refused", "remote-unreachable"],
      ["ssh: connect to host x port 22: Operation timed out", "remote-unreachable"],
      ["connect: Network is unreachable", "remote-unreachable"],
      ["fatal: '/x' does not appear to be a git repository", "remote-unreachable"],
      ["something git never said before", "remote-unreachable"],
    ];
    for (const [output, kind] of cases) assert.equal(classifyPushFailure(output), kind, output);
  });

  test("--once says Pushed; the loop logs Pushed to origin", async () => {
    const out: string[] = [];
    const output = { out: (t: string) => out.push(t), err: () => {} };
    const once = await pushingFolder(await bareRepo());
    assert.equal(await run(["sync", "--once", once], output, deps), 0);
    assert.match(out[0]!, /^Committed [0-9a-f]+\. Pushed\.$/);

    const dir = await pushingFolder(await bareRepo());
    const controller = new AbortController();
    const log: string[] = [];
    await syncLoop(dir, controller.signal, { now: () => NOW, log: (l) => log.push(l), sleep: async () => controller.abort() });
    assert.equal(log.length, 2);
    assert.match(log[0]!, / Committed /);
    assert.equal(log[1], `${NOW.toISOString()} Pushed to origin.`);
  });
});

describe("remote visibility", () => {
  const GH = "https://github.com/o/r.git";
  const HOUR = 3_600_000;
  const withRemote = (remote: string) => ({ ...CONFIG, remote });
  const setRemote = (dir: string, remote: string) =>
    put(dir, `${DATA}/${GIT_INTEGRATION}/config.json`, json({ key: "config", value: withRemote(remote) }));
  const at = (ms: number) => ({ now: () => new Date(NOW.getTime() + ms) });

  /** A fetch that records the URLs asked and answers like GitHub for a public repository, or fails like a network. */
  function fakeFetch(mode: { offline: boolean } = { offline: false }) {
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(url);
      if (mode.offline) throw new TypeError("fetch failed");
      return { status: 200, json: async () => ({ private: false }) };
    };
    return { urls, fetch, mode };
  }

  test("a public github remote gives public", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch } = fakeFetch();
    const result = await syncOnce(dir, { ...deps, fetch });
    assert.equal(result.status?.remoteVisibility, "public");
    assert.equal((await statusOf(dir)).remoteVisibility, "public");
    assert.deepEqual(urls, ["https://api.github.com/repos/o/r"]);
  });

  test("a second round within the hour does not ask again, one after the hour does", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch } = fakeFetch();
    const visibility = {};
    await syncOnce(dir, { ...at(0), fetch, visibility });
    const second = await syncOnce(dir, { ...at(HOUR - 1), fetch, visibility });
    assert.equal(urls.length, 1);
    assert.equal(second.status?.remoteVisibility, "public");
    await syncOnce(dir, { ...at(HOUR), fetch, visibility });
    assert.equal(urls.length, 2);
  });

  test("a changed remote is checked again", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch } = fakeFetch();
    const visibility = {};
    await syncOnce(dir, { ...at(0), fetch, visibility });
    await setRemote(dir, "git@github.com:o/other.git");
    await syncOnce(dir, { ...at(1000), fetch, visibility });
    assert.deepEqual(urls, ["https://api.github.com/repos/o/r", "https://api.github.com/repos/o/other"]);
  });

  test("offline keeps the last known value", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch, mode } = fakeFetch();
    const visibility = {};
    await syncOnce(dir, { ...at(0), fetch, visibility });
    mode.offline = true;
    const result = await syncOnce(dir, { ...at(HOUR), fetch, visibility });
    assert.equal(urls.length, 2);
    assert.equal(result.status?.remoteVisibility, "public");
    assert.equal((await statusOf(dir)).remoteVisibility, "public");
  });

  test("separate calls without a shared memo each ask (--once)", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch } = fakeFetch();
    await syncOnce(dir, { ...deps, fetch });
    await syncOnce(dir, { ...deps, fetch });
    assert.equal(urls.length, 2);
  });

  test("a local remote is unknown and nothing is asked", async () => {
    const dir = await modulesFolder({ config: withRemote("/srv/git/r.git") });
    const { urls, fetch } = fakeFetch();
    const result = await syncOnce(dir, { ...deps, fetch });
    assert.equal(result.status?.remoteVisibility, "unknown");
    assert.equal(urls.length, 0);
  });

  test("an empty remote leaves the field out", async () => {
    const dir = await modulesFolder();
    const { urls, fetch } = fakeFetch();
    const result = await syncOnce(dir, { ...deps, fetch });
    assert.equal("remoteVisibility" in result.status!, false);
    assert.equal(urls.length, 0);
  });

  test("a round skipped by index.lock still reports it", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { fetch } = fakeFetch();
    await syncOnce(dir, { ...deps, fetch });
    await writeFile(join(dir, ".git", "index.lock"), "");
    const result = await syncOnce(dir, { ...deps, fetch, visibility: {} });
    assert.equal(result.status?.remoteVisibility, "public");
  });

  test("without a valid config the last known value is carried over", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch } = fakeFetch();
    await syncOnce(dir, { ...deps, fetch });
    await put(dir, `${DATA}/${GIT_INTEGRATION}/config.json`, "not json");
    const result = await syncOnce(dir, { ...deps, fetch });
    assert.equal(result.problem, "no-config");
    assert.equal(result.status?.remoteVisibility, "public");
    assert.equal(urls.length, 1);
  });

  test("the loop asks once over several rounds", async () => {
    const dir = await modulesFolder({ config: withRemote(GH) });
    const { urls, fetch } = fakeFetch();
    const controller = new AbortController();
    let rounds = 0;
    await syncLoop(dir, controller.signal, { ...deps, fetch, log: () => {}, sleep: async () => void (++rounds >= 3 && controller.abort()) });
    assert.equal(rounds, 3);
    assert.equal(urls.length, 1);
  });
});
