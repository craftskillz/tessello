import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

// The tests must not depend on (or touch) the identity and settings of whoever runs them.
process.env.GIT_CONFIG_GLOBAL = join(await mkdtemp(join(tmpdir(), "tessello-gitconfig-")), "gitconfig");
await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
process.env.GIT_CONFIG_NOSYSTEM = "1";

const { keyFileName } = await import("../../host/src/folder-persistence.ts");
const { syncLivingDocumentation } = await import("../src/living-documentation-sync.ts");

const NOW = new Date("2026-03-01T10:00:00.000Z");
const OLD = new Date("2026-03-01T09:00:00.000Z");
const deps = { now: () => NOW };
const DIR = ".tessello/data/@craftskillz/living-documentation";

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

/** Writes a file (made old enough to be past the quiet period) and creates its folders. */
async function put(dir: string, path: string, content: string, mtime = OLD): Promise<void> {
  await mkdir(join(dir, path, ".."), { recursive: true });
  await writeFile(join(dir, path), content);
  await utimes(join(dir, path), mtime, mtime);
}

/** A Modules folder whose Living Documentation storage holds the given Projects under `sync`. */
async function modulesFolder(projects: unknown[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tessello-ld-modules-"));
  await put(dir, `${DIR}/sync.json`, json({ key: "sync", value: { projects } }));
  return dir;
}

/** A real repository with one commit; `name` is the folder's name. */
async function repository(name = "arolla"): Promise<string> {
  const dir = join(await mkdtemp(join(tmpdir(), "tessello-ld-repo-")), name);
  await mkdir(dir);
  git(dir, "init", "-b", "main");
  await put(dir, "README.md", "# readme\n");
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t.t", "commit", "-m", "init");
  return dir;
}

async function syncStatus(modules: string) {
  return JSON.parse(await readFile(join(modules, DIR, "sync%53tatus.json"), "utf8"));
}
const subjects = (repo: string) => git(repo, "log", "--format=%s").split("\n").filter(Boolean);
const project = (id: string, extra: object = {}) => ({ id, name: id, repository: "arolla", ...extra });

test("the files of the keys sync and syncStatus agree with the Host's keyFileName", async () => {
  assert.equal(await keyFileName("sync"), "sync.json");
  assert.equal(await keyFileName("syncStatus"), "sync%53tatus.json");
});

describe("syncLivingDocumentation", () => {
  test("commits the Project folder found by its location, and writes syncStatus", async () => {
    const repo = await repository();
    await put(repo, "docs/guide.md", "# guide\n");
    await put(repo, "docs/api.md", "# api\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual(result.problems, []);
    assert.equal(result.lines.length, 1);
    assert.equal(subjects(repo)[0], "Living Documentation: docs/api.md, docs/guide.md");
    assert.equal(git(repo, "log", "-1", "--format=%ae").trim(), "sync@tessello.invalid");
    const sha = git(repo, "rev-parse", "--short", "HEAD").trim();
    assert.deepEqual(await syncStatus(modules), {
      key: "syncStatus",
      value: {
        heartbeat: NOW.toISOString(),
        projects: { p1: { repository: repo, lastCommit: { at: NOW.toISOString(), id: sha, documents: ["docs/api.md", "docs/guide.md"] } } },
      },
    });
    assert.deepEqual((await readdir(join(modules, DIR))).sort(), ["sync%53tatus.json", "sync.json"]);
  });

  test("finds a Project by its repository name and path when it has no location", async () => {
    const repo = await repository("arolla");
    await put(repo, "docs/guide.md", "# guide\n");
    const modules = await modulesFolder([project("p1", { path: "docs" })]);

    await syncLivingDocumentation(modules, [repo], deps);

    assert.equal(subjects(repo)[0], "Living Documentation: docs/guide.md");
  });

  test("does not take a Project without location or path, nor one of another repository name", async () => {
    const repo = await repository("arolla");
    await put(repo, "docs/guide.md", "# guide\n");
    const modules = await modulesFolder([project("p1"), project("p2", { repository: "other", path: "docs" })]);

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0]!, /^Cannot sync .*arolla: no Living Documentation Project is configured in this repository\. In Living Documentation, open Project settings › Repository and connect this repository to the Project\.$/);
    assert.equal(subjects(repo).length, 1);
    assert.deepEqual((await syncStatus(modules)).value.projects, {});
  });

  test("expands ~ in the location, and takes the repository itself when the location is its root", async () => {
    const repo = await repository();
    await put(repo, "a.md", "# a\n");
    await put(repo, "b.txt", "b\n");
    const home = join(repo, "..");
    const modules = await modulesFolder([project("p1", { location: "~/arolla" })]);

    await syncLivingDocumentation(modules, [repo], { ...deps, home });

    assert.equal(subjects(repo)[0], "Living Documentation: a.md");
    assert.deepEqual(git(repo, "show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean), ["a.md", "b.txt"]);
  });

  test("the first repository that matches takes the Project", async () => {
    const first = await repository("arolla");
    const second = await repository("arolla");
    await put(first, "docs/a.md", "a\n");
    await put(second, "docs/b.md", "b\n");
    const modules = await modulesFolder([project("p1", { path: "docs" })]);

    const result = await syncLivingDocumentation(modules, [first, second], deps);

    assert.equal(subjects(first)[0], "Living Documentation: docs/a.md");
    assert.equal(subjects(second).length, 1);
    assert.equal(result.problems.length, 1);
  });

  test("commits only the Project folders: what the developer staged or changed elsewhere is left alone", async () => {
    const repo = await repository();
    await put(repo, "docs/guide.md", "# guide\n");
    await put(repo, "src/staged.ts", "staged\n");
    git(repo, "add", "src/staged.ts");
    await put(repo, "README.md", "# edited readme\n");
    await put(repo, "src/untracked.ts", "u\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual(git(repo, "show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean), ["docs/guide.md"]);
    assert.equal(git(repo, "status", "--porcelain").split("\n").sort().join("|"), "|?? src/untracked.ts|A  src/staged.ts| M README.md".split("|").sort().join("|"));
  });

  test("commits deleted and renamed Documents, which stay in the lastCommit", async () => {
    const repo = await repository();
    await put(repo, "docs/old.md", "old\n");
    await put(repo, "docs/gone.md", "gone\n");
    git(repo, "add", "-A");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@t.t", "commit", "-m", "docs");
    git(repo, "mv", "docs/old.md", "docs/new.md");
    git(repo, "rm", "-q", "docs/gone.md");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual((await syncStatus(modules)).value.projects.p1.lastCommit.documents, ["docs/gone.md", "docs/new.md", "docs/old.md"]);
    assert.equal(git(repo, "status", "--porcelain"), "");
  });

  test("a commit message without Documents counts the files; a long one is cut with a count", async () => {
    const repo = await repository();
    await put(repo, "docs/a.txt", "a\n");
    await put(repo, "docs/b.txt", "b\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);
    await syncLivingDocumentation(modules, [repo], deps);
    assert.equal(subjects(repo)[0], "Living Documentation: 2 files");

    for (let i = 0; i < 20; i++) await put(repo, `docs/a-rather-long-document-name-${String(i).padStart(2, "0")}.md`, "x\n");
    await syncLivingDocumentation(modules, [repo], deps);
    const subject = subjects(repo)[0]!;
    assert.match(subject, /^Living Documentation: docs\/a-rather-long-document-name-00\.md, .*, … \(\+\d+ more\)$/);
    assert.ok(subject.length < 140);
  });

  test("uses the identity of the repository when it has one", async () => {
    const repo = await repository();
    git(repo, "config", "user.email", "me@example.com");
    git(repo, "config", "user.name", "Me");
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    await syncLivingDocumentation(modules, [repo], deps);

    assert.equal(git(repo, "log", "-1", "--format=%ae").trim(), "me@example.com");
  });

  test("a Project folder named with glob characters matches only itself", async () => {
    const repo = await repository();
    await put(repo, "docs[1]/a.md", "a\n");
    await put(repo, "docs1/b.md", "b\n");
    await put(repo, "star*/c.md", "c\n");
    await put(repo, "starry/d.md", "d\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs[1]") }), project("p2", { location: join(repo, "star*") })]);

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual(result.problems, []);
    assert.deepEqual(git(repo, "show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean), ["docs[1]/a.md", "star*/c.md"]);
    assert.match(git(repo, "status", "--porcelain"), /\?\? docs1\/\n\?\? starry\//);
  });

  test("uses the fallback identity when the repository has an email but no name", async () => {
    const repo = await repository();
    git(repo, "config", "user.email", "me@example.com");
    git(repo, "config", "user.useConfigOnly", "true");
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual(result.problems, []);
    assert.equal(subjects(repo)[0], "Living Documentation: docs/a.md");
  });

  test("a location reached through a symlink to the repository matches it", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const link = join(await mkdtemp(join(tmpdir(), "tessello-ld-link-")), "link");
    await symlink(repo, link);
    const modules = await modulesFolder([project("p1", { location: join(link, "docs") })]);

    await syncLivingDocumentation(modules, [repo], deps);

    assert.equal(subjects(repo)[0], "Living Documentation: docs/a.md");
  });

  test("a Project folder named with leading dots is inside the repository", async () => {
    const repo = await repository();
    await put(repo, "..docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "..docs") })]);

    await syncLivingDocumentation(modules, [repo], deps);

    assert.equal(subjects(repo)[0], "Living Documentation: ..docs/a.md");
  });

  test("a failing git add is a commit-failed problem carrying git's message", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);
    const wrapper = join(await mkdtemp(join(tmpdir(), "tessello-ld-git-")), "git");
    await writeFile(wrapper, '#!/bin/sh\nfor a in "$@"; do if [ "$a" = add ]; then echo "fatal: unable to create index.lock" >&2; exit 128; fi; done\nexec git "$@"\n', { mode: 0o755 });

    const result = await syncLivingDocumentation(modules, [repo], { ...deps, git: wrapper });

    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0]!, /unable to create index\.lock/);
    assert.equal((await syncStatus(modules)).value.projects.p1.problem.kind, "commit-failed");
    assert.equal(subjects(repo).length, 1);
  });

  test("an index.lock of a worktree (whose .git is a file) skips it", async () => {
    const repo = await repository();
    const tree = join(await mkdtemp(join(tmpdir(), "tessello-ld-tree-")), "arolla");
    git(repo, "worktree", "add", "-b", "other", tree);
    await put(tree, "docs/a.md", "a\n");
    await put(git(tree, "rev-parse", "--absolute-git-dir").trim(), "index.lock", "");
    const modules = await modulesFolder([project("p1", { location: join(tree, "docs") })]);

    const result = await syncLivingDocumentation(modules, [tree], deps);

    assert.deepEqual(result, { lines: [], problems: [] });
    assert.equal(subjects(tree).length, 1);
  });

  test("skips the repository hooks (--no-verify)", async () => {
    const repo = await repository();
    await put(repo, ".git/hooks/pre-commit", "#!/bin/sh\nexit 1\n");
    await import("node:fs/promises").then((fs) => fs.chmod(join(repo, ".git/hooks/pre-commit"), 0o755));
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual(result.problems, []);
    assert.equal(subjects(repo)[0], "Living Documentation: docs/a.md");
  });

  test("nothing to commit: no commit, no lastCommit, the heartbeat is still written", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);
    await syncLivingDocumentation(modules, [repo], deps);
    const count = subjects(repo).length;
    const later = new Date(NOW.getTime() + 60_000);

    const result = await syncLivingDocumentation(modules, [repo], { now: () => later });

    assert.deepEqual(result, { lines: [], problems: [] });
    assert.equal(subjects(repo).length, count);
    const value = (await syncStatus(modules)).value;
    assert.equal(value.heartbeat, later.toISOString());
    assert.equal(value.projects.p1.lastCommit.at, NOW.toISOString());
  });

  test("a file modified within the quiet period postpones the commit to the next round", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n", new Date(NOW.getTime() - 2_000));
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);

    const result = await syncLivingDocumentation(modules, [repo], deps);
    assert.deepEqual(result, { lines: [], problems: [] });
    assert.equal(subjects(repo).length, 1);

    await syncLivingDocumentation(modules, [repo], { now: () => new Date(NOW.getTime() + 20_000) });
    assert.equal(subjects(repo)[0], "Living Documentation: docs/a.md");
  });

  test("an index.lock skips the repository and keeps what the Projects had", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);
    await syncLivingDocumentation(modules, [repo], deps);
    const before = (await syncStatus(modules)).value.projects.p1;
    await put(repo, "docs/b.md", "b\n");
    await put(repo, ".git/index.lock", "");

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.deepEqual(result, { lines: [], problems: [] });
    assert.equal(subjects(repo).length, 2);
    assert.deepEqual((await syncStatus(modules)).value.projects.p1, before);
  });

  test("a folder that does not exist is a not-found problem for the Projects found by location; the others go on", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const missing = join(repo, "..", "nowhere");
    const modules = await modulesFolder([
      project("p1", { location: join(missing, "docs") }),
      project("p2", { location: join(repo, "docs") }),
    ]);

    const result = await syncLivingDocumentation(modules, [missing, repo], deps);

    const message = `Cannot sync ${missing}: the folder does not exist.`;
    assert.deepEqual(result.problems, [message]);
    assert.equal(subjects(repo)[0], "Living Documentation: docs/a.md");
    const projects = (await syncStatus(modules)).value.projects;
    assert.deepEqual(projects.p1.problem, { kind: "not-found", message, since: NOW.toISOString() });
    assert.equal(projects.p2.problem, undefined);
  });

  test("a folder without .git is a not-a-repository problem", async () => {
    const plain = await mkdtemp(join(tmpdir(), "tessello-ld-plain-"));
    await put(plain, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(plain, "docs") })]);

    const result = await syncLivingDocumentation(modules, [plain], deps);

    const message = `Cannot sync ${plain}: it is not a git repository (no .git).`;
    assert.deepEqual(result.problems, [message]);
    assert.deepEqual((await syncStatus(modules)).value.projects.p1.problem, { kind: "not-a-repository", message, since: NOW.toISOString() });
  });

  test("a folder that is not a git repository is reported even when no Project matches it", async () => {
    const plain = await mkdtemp(join(tmpdir(), "tessello-ld-plain-"));
    const modules = await modulesFolder([project("p1", { location: join(plain, "..", "elsewhere", "docs") })]);

    const result = await syncLivingDocumentation(modules, [plain], deps);

    assert.deepEqual(result.problems, [`Cannot sync ${plain}: it is not a git repository (no .git).`]);
    assert.deepEqual((await syncStatus(modules)).value.projects, {});
  });

  test("a problem keeps its `since` while it lasts and is cleared when the repository goes fine", async () => {
    const plain = await mkdtemp(join(tmpdir(), "tessello-ld-plain-"));
    await put(plain, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(plain, "docs") })]);
    await syncLivingDocumentation(modules, [plain], deps);
    const later = new Date(NOW.getTime() + 60_000);

    await syncLivingDocumentation(modules, [plain], { now: () => later });
    assert.equal((await syncStatus(modules)).value.projects.p1.problem.since, NOW.toISOString());

    git(plain, "init", "-b", "main");
    await syncLivingDocumentation(modules, [plain], { now: () => later });
    const entry = (await syncStatus(modules)).value.projects.p1;
    assert.equal(entry.problem, undefined);
    assert.equal(entry.lastCommit.at, later.toISOString());
  });

  test("a failing commit is a commit-failed problem carrying git's message", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") })]);
    // A git that cannot commit: a wrapper that fails on `commit` and runs git otherwise.
    const wrapper = join(await mkdtemp(join(tmpdir(), "tessello-ld-git-")), "git");
    await writeFile(wrapper, '#!/bin/sh\nfor a in "$@"; do if [ "$a" = commit ]; then echo "fatal: cannot lock ref" >&2; exit 128; fi; done\nexec git "$@"\n', { mode: 0o755 });

    const result = await syncLivingDocumentation(modules, [repo], { ...deps, git: wrapper });

    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0]!, /fatal: cannot lock ref/);
    const problem = (await syncStatus(modules)).value.projects.p1.problem;
    assert.equal(problem.kind, "commit-failed");
    assert.match(problem.message, /fatal: cannot lock ref/);
  });

  test("a Project removed from `sync` disappears from syncStatus; a malformed entry is dropped", async () => {
    const repo = await repository();
    await put(repo, "docs/a.md", "a\n");
    const modules = await modulesFolder([project("p1", { location: join(repo, "docs") }), { id: 3 }, "x", project("p2", { path: "docs" })]);
    await syncLivingDocumentation(modules, [repo], deps);
    assert.deepEqual(Object.keys((await syncStatus(modules)).value.projects).sort(), ["p1", "p2"]);

    await put(modules, `${DIR}/sync.json`, json({ key: "sync", value: { projects: [project("p2", { path: "docs" })] } }));
    await syncLivingDocumentation(modules, [repo], deps);
    assert.deepEqual(Object.keys((await syncStatus(modules)).value.projects), ["p2"]);
  });

  test("without a `sync` key it only reports that no Project is configured, and still writes syncStatus", async () => {
    const repo = await repository();
    const modules = await mkdtemp(join(tmpdir(), "tessello-ld-modules-"));

    const result = await syncLivingDocumentation(modules, [repo], deps);

    assert.equal(result.problems.length, 1);
    assert.deepEqual((await syncStatus(modules)).value, { heartbeat: NOW.toISOString(), projects: {} });
  });
});
