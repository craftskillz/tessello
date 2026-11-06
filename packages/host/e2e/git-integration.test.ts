// The Git Integration Module and `tessello sync` together, through the only channel between them: the Module's
// storage (ADR 0020). The View writes `config`; the real CLI reads it, commits and pushes the Modules folder, and writes
// `status`; the View shows it. Neither side is tested here for its own rules (the Module's are in its repository, the
// command's in packages/cli): this proves that what one writes the other understands, in the Host.
//
// The Modules folder of these tests is in the OPFS, which no program outside the browser can open. So, as for the
// tools of a User (see browser.ts), the test plays the engine's place: it copies the folder to a folder of the disk,
// runs `tessello sync --once` there, and writes back the `status.json` the command left, as the engine would in the
// folder the Host watches. The folder of the disk (and its `.git`) is kept from one round to the next.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { after, before, describe, test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Page } from "playwright";
import { dropFile, moduleFixture, readFolder, readFolderBytes, showLauncher, until, useHost, writeFolder } from "./browser.ts";

const host = useHost();
const run = promisify(execFile);

const CLI = fileURLToPath(new URL("../../cli/src/cli.ts", import.meta.url));
const GIT_DATA = "modules/.tessello/data/@craftskillz/git-integration";
const SURVIVAL_DATA = ".tessello/data/@craftskillz/survival-kit";
const gitView = (page: Page) => page.frameLocator("iframe[title='Git Integration']");
const survivalView = (page: Page) => page.frameLocator("iframe[title='Survival Kit']");

let temp: string;
/** The Modules folder as `tessello sync` sees it, on the disk. */
let disk: string;
/** The remote repository: a local bare one, so that nothing goes to the network (and no visibility is asked). */
let remote: string;
let env: NodeJS.ProcessEnv;

before(async () => {
  temp = await mkdtemp(join(tmpdir(), "tessello-git-integration-"));
  disk = join(temp, "modules");
  remote = join(temp, "remote.git");
  await mkdir(disk);
  // Git knows nothing of the developer's config (identity, hooks, signing, url rewrites): the run is the same on every
  // machine, and the command commits under its own identity.
  const config = join(temp, "gitconfig");
  await writeFile(config, "");
  env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1", HOME: temp };
  await run("git", ["init", "--bare", "-b", "main", remote], { env });
});

after(() => rm(temp, { recursive: true, force: true }));

const git = (...args: string[]) => run("git", args, { env });

/** Installs a package from its .zip, by accepting what it asks for; the Host then shows its View. */
async function install(page: Page, fixture: string, name: string) {
  await dropFile(page, `${fixture}.zip`, await moduleFixture(fixture));
  await page.getByRole("dialog", { name: `Install ${name}?` }).getByRole("button", { name: "Accept and install" }).click();
  await page.locator(`iframe[title='${name}']`).waitFor();
}

async function open(page: Page, name: string) {
  await (await showLauncher(page)).getByRole("button", { name, exact: true }).click();
  await page.locator(`iframe[title='${name}']`).waitFor();
}

/** The storage of the Git Integration Module as the Host wrote it: key → value. */
async function gitStorage(page: Page): Promise<Record<string, any>> {
  const files = Object.values(await readFolder(page, GIT_DATA)).map((file) => JSON.parse(file) as { key: string; value: unknown });
  return Object.fromEntries(files.map((file) => [file.key, file.value]));
}

/**
 * One round of the engine: the Modules folder of the OPFS is copied to the disk, `tessello sync --once` runs there for
 * real, and the `status.json` it wrote goes back to the OPFS. Nothing of `.git` goes back.
 */
async function round(page: Page): Promise<{ code: number; stdout: string; stderr: string }> {
  // Written a minute ago: the command waits 10 s after the last change of a file before committing it (it may still be
  // being written), and a test cannot wait that long.
  const past = new Date(Date.now() - 60_000);
  for (const [path, bytes] of Object.entries(await readFolderBytes(page, "modules"))) {
    const file = join(disk, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await utimes(file, past, past);
  }
  const result = await run(process.execPath, [CLI, "sync", "--once", disk], { env }).then(
    ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
    (error) => ({ code: error.code as number, stdout: error.stdout as string, stderr: error.stderr as string }),
  );
  const status = await readFile(join(disk, GIT_DATA.replace("modules/", ""), "status.json"), "utf8");
  await writeFolder(page, GIT_DATA, { "status.json": status });
  return result;
}

describe("the Git Integration Module and tessello sync", () => {
  test("data a Module wrote is committed and pushed by sync, and the View shows the new commit", async () => {
    const page = await host.newPage();
    await install(page, "git-integration", "Git Integration");
    await install(page, "survival-kit", "Survival Kit");

    await open(page, "Git Integration");
    await gitView(page).getByRole("textbox", { name: "Remote repository URL" }).fill(remote);
    await until(async () => (await gitStorage(page)).config?.remote === remote, "the Host to write the configuration");

    // The list of Modules comes from what the engine found installed: it appears after a first round.
    const first = await round(page);
    assert.equal(first.code, 0, first.stderr);
    const firstHead = (await git("-C", remote, "rev-parse", "main")).stdout.trim();
    const versioned = gitView(page).getByRole("checkbox", { name: "Version the data of Survival Kit" });
    await versioned.check();
    await until(async () => (await gitStorage(page)).config?.dataModules?.includes("@craftskillz/survival-kit"), "the Host to write the Module to version");

    await open(page, "Survival Kit");
    await survivalView(page).getByRole("textbox", { name: "New task" }).fill("Renew the certificate");
    await survivalView(page).getByRole("button", { name: "Add task" }).click();
    await until(async () => {
      const files = await readFolder(page, `modules/${SURVIVAL_DATA}`);
      return Object.values(files).some((file) => file.includes("Renew the certificate"));
    }, "the Host to write the task");

    const second = await round(page);
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /Committed [0-9a-f]+\. Pushed\./);

    // The remote repository holds the data of Survival Kit in a new commit.
    const head = (await git("-C", remote, "rev-parse", "main")).stdout.trim();
    assert.notEqual(head, firstHead);
    const { stdout: files } = await git("-C", remote, "log", "main", "-1", "--name-only", "--format=");
    const dataFiles = files.split("\n").filter((path) => path.startsWith(`${SURVIVAL_DATA}/`));
    assert.ok(dataFiles.length > 0, `the last commit of main holds data of Survival Kit:\n${files}`);
    const contents = await Promise.all(dataFiles.map(async (path) => (await git("-C", remote, "show", `main:${path}`)).stdout));
    assert.ok(contents.some((content) => content.includes("Renew the certificate")), `no file of the last commit holds the task:\n${dataFiles.join("\n")}`);

    await viewShowsCommit(page, head);
  });
});

/**
 * The View shows the last commit of the status. Both rounds' commits touch Git Integration (its own data is versioned
 * too) and Survival Kit, so the text alone cannot tell them apart: the test checks the status holds the second one.
 */
async function viewShowsCommit(page: Page, head: string) {
  const status = (await gitStorage(page)).status;
  assert.ok(head.startsWith(status.lastCommit.sha), `the status names the last commit ${head}: ${status.lastCommit.sha}`);
  await open(page, "Git Integration");
  // The View reads the status every 3 s.
  await until(() => gitView(page).getByText("Last commit just now touching Git Integration, Survival Kit").isVisible(), "the View to show the commit");
  await until(() => gitView(page).getByText("Last push just now").isVisible(), "the View to show the push");
}
