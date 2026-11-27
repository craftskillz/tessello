import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

// The tests must not depend on (or touch) the identity and settings of whoever runs them.
process.env.GIT_CONFIG_GLOBAL = join(await mkdtemp(join(tmpdir(), "tessello-gitconfig-")), "gitconfig");
await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
process.env.GIT_CONFIG_NOSYSTEM = "1";

const { run } = await import("../src/cli.ts");
const { syncLoop } = await import("../src/sync-command.ts");

const NOW = new Date("2026-03-01T10:00:00.000Z");
const OLD = new Date("2026-03-01T09:00:00.000Z");
const deps = { now: () => NOW };
const DATA = ".tessello/data";
const LD = `${DATA}/@craftskillz/living-documentation`;
const GIT_INTEGRATION = `${DATA}/@craftskillz/git-integration`;
const CONFIG = { remote: "", push: false, intervalSeconds: 30, dataModules: ["@craftskillz/living-documentation"] };

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
const subjects = (repo: string) => git(repo, "log", "--format=%s").split("\n").filter(Boolean);

async function put(dir: string, path: string, content: string, mtime = OLD): Promise<void> {
  await mkdir(join(dir, path, ".."), { recursive: true });
  await writeFile(join(dir, path), content);
  await utimes(join(dir, path), mtime, mtime);
}

/** A Modules folder with Living Documentation's `sync` key; Git Integration's config only when `config` is not null. */
async function modulesFolder(projects: unknown[], config: unknown = CONFIG): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tessello-ldsync-modules-"));
  await put(dir, ".tessello/modules.json", json({ modules: [] }));
  await put(dir, `${LD}/sync.json`, json({ key: "sync", value: { projects } }));
  if (config !== null) await put(dir, `${GIT_INTEGRATION}/config.json`, json({ key: "config", value: config }));
  return dir;
}

async function repository(name: string): Promise<string> {
  const dir = join(await mkdtemp(join(tmpdir(), "tessello-ldsync-repo-")), name);
  await mkdir(dir);
  git(dir, "init", "-b", "main");
  await put(dir, "README.md", "# readme\n");
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t.t", "commit", "-m", "init");
  return dir;
}

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, output: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
}

/** A repository with an uncommitted Document, and a Project pointing at it. */
async function documented(name = "arolla") {
  const repo = await repository(name);
  await put(repo, "docs/guide.md", "# guide\n");
  return { repo, project: { id: "p1", name: "P1", repository: name, location: join(repo, "docs") } };
}

describe("tessello sync --living-documentation", () => {
  test("the option needs a value, and a repeatable one at that: usage error otherwise", async () => {
    const dir = await modulesFolder([]);
    for (const args of [["--living-documentation"], ["--living-documentation", "--once"], ["--once", dir, "--living-documentation"]]) {
      const { err, output } = capture();
      assert.equal(await run(["sync", ...args], output, deps), 2, args.join(" "));
      assert.match(err.join("\n"), /Usage: tessello sync \[--once\] \[--living-documentation <repository>\]… \[folder\]/);
    }
  });

  test("refuses outside a Modules folder and commits nothing in the repository", async () => {
    const { repo } = await documented();
    const elsewhere = await mkdtemp(join(tmpdir(), "tessello-ldsync-"));
    const { err, output } = capture();

    assert.equal(await run(["sync", "--once", "--living-documentation", repo, elsewhere], output, deps), 1);

    assert.match(err.join("\n"), /is not a Modules folder/);
    assert.equal(subjects(repo).length, 1);
  });

  test("without Git Integration's config: the Project is committed, the Modules folder is not backed up", async () => {
    const { repo, project } = await documented();
    const modules = await modulesFolder([project], null);
    const { out, err, output } = capture();

    assert.equal(await run(["sync", "--once", "--living-documentation", repo, modules], output, deps), 0);

    assert.equal(subjects(repo)[0], "Living Documentation: docs/guide.md");
    assert.match(out.join("\n"), /Committed [0-9a-f]+ in .*arolla: docs\/guide\.md/);
    assert.deepEqual(err, []);
    assert.equal(existsSync(join(modules, ".git")), false);
    assert.equal(existsSync(join(modules, GIT_INTEGRATION, "status.json")), false);
    assert.equal(existsSync(join(modules, LD, "sync%53tatus.json")), true);
  });

  test("with the config: the Modules folder and the Project are both committed", async () => {
    const { repo, project } = await documented();
    const modules = await modulesFolder([project]);
    const { out, output } = capture();

    assert.equal(await run(["sync", "--once", "--living-documentation", repo, modules], output, deps), 0);

    assert.equal(subjects(repo)[0], "Living Documentation: docs/guide.md");
    assert.equal(subjects(modules).length, 1);
    assert.equal(out.length, 2);
    assert.match(out[0]!, /^Committed [0-9a-f]+\.$/);
    assert.match(out[1]!, /Committed [0-9a-f]+ in /);
  });

  test("nothing committed anywhere says so", async () => {
    const { repo, project } = await documented();
    const modules = await modulesFolder([project], null);
    await run(["sync", "--once", "--living-documentation", repo, modules], capture().output, deps);
    const { out, output } = capture();

    assert.equal(await run(["sync", "--once", "--living-documentation", repo, modules], output, deps), 0);

    assert.deepEqual(out, ["Nothing to commit."]);
  });

  test("a Living Documentation problem is on err and exits 1, the other repository is still committed", async () => {
    const { repo, project } = await documented("arolla");
    const lonely = await repository("lonely");
    const modules = await modulesFolder([project], null);
    const { out, err, output } = capture();

    const code = await run(["sync", "--once", "--living-documentation", lonely, "--living-documentation", repo, modules], output, deps);

    assert.equal(code, 1);
    assert.match(err.join("\n"), /lonely: no Living Documentation Project is configured/);
    assert.equal(subjects(repo)[0], "Living Documentation: docs/guide.md");
    assert.equal(out.length, 1);
  });

  test("the loop logs the commit lines and the problems of Living Documentation, with the interval of the round", async () => {
    const { repo, project } = await documented("arolla");
    const lonely = await repository("lonely");
    const modules = await modulesFolder([project]);
    const controller = new AbortController();
    const log: string[] = [];
    const sleeps: number[] = [];

    await syncLoop(
      modules,
      controller.signal,
      { now: () => NOW, log: (l) => log.push(l), sleep: async (ms) => void (sleeps.push(ms), controller.abort()) },
      [repo, lonely],
    );

    assert.deepEqual(sleeps, [30_000]);
    assert.ok(log.some((l) => l.startsWith(NOW.toISOString()) && /Committed [0-9a-f]+ in .*arolla: docs\/guide\.md/.test(l)));
    assert.ok(log.some((l) => l.startsWith(NOW.toISOString()) && /lonely: no Living Documentation Project/.test(l)));
  });

  test("the loop without config still syncs the repositories, every 60 s, and leaves the Modules folder alone", async () => {
    const { repo, project } = await documented();
    const modules = await modulesFolder([project], null);
    const controller = new AbortController();
    const log: string[] = [];
    const sleeps: number[] = [];

    await syncLoop(modules, controller.signal, { now: () => NOW, log: (l) => log.push(l), sleep: async (ms) => void (sleeps.push(ms), controller.abort()) }, [repo]);

    assert.deepEqual(sleeps, [60_000]);
    assert.equal(log.length, 1);
    assert.equal(existsSync(join(modules, ".git")), false);
  });

  test("the continuous command announces the repositories", async () => {
    const { repo, project } = await documented();
    const modules = await modulesFolder([project]);
    const { out, output } = capture();

    assert.equal(await run(["sync", "--living-documentation", repo, modules], output, { now: () => NOW, signal: AbortSignal.abort() }), 0);

    assert.match(out[0]!, /Syncing ".*" and the Living Documentation of .*arolla round after round/);
  });

  test("the Modules-folder backup does not commit the Living Documentation status at every round", async () => {
    const { repo, project } = await documented();
    const modules = await modulesFolder([project]);
    const args = ["sync", "--once", "--living-documentation", repo, modules];
    await run(args, capture().output, deps);
    const before = subjects(modules).length;

    await run(args, capture().output, { now: () => new Date(NOW.getTime() + 60_000) });

    assert.equal(subjects(modules).length, before);
    assert.equal(git(modules, "ls-files", "--", `${LD}/sync%53tatus.json`).trim(), "");
    assert.match(await readFile(join(modules, ".gitignore"), "utf8"), /living-documentation\/sync%53tatus\.json/);
  });
});
