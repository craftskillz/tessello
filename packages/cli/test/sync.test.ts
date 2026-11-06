import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

// The tests must not depend on (or touch) the identity and settings of whoever runs them.
process.env.GIT_CONFIG_GLOBAL = join(await mkdtemp(join(tmpdir(), "tessello-gitconfig-")), "gitconfig");
await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
process.env.GIT_CONFIG_NOSYSTEM = "1";

const { keyFileName } = await import("../../host/src/folder-persistence.ts");
const { run } = await import("../src/cli.ts");
const { syncOnce } = await import("../src/sync-command.ts");

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
    assert.equal(await run(["sync", "--once", good], output), 0);
    assert.equal(commitCount(good), 1);

    const bad = await mkdtemp(join(tmpdir(), "tessello-sync-"));
    assert.equal(await run(["sync", "--once", bad], output), 1);
    assert.match(err.join("\n"), /modules\.json/);

    err.length = 0;
    assert.equal(await run(["sync", good], output), 2);
    assert.match(err.join("\n"), /--once/);
  });
});
