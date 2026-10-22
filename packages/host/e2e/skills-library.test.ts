import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, readFolder, showLauncher, useHost, zipSample } from "./browser.ts";

const host = useHost();

let skillsLibrary: Uint8Array;
before(async () => {
  skillsLibrary = await zipSample("skills-library");
});

const DATA = "modules/.tessello/data/@craftskillz/skills-library";

const view = (page: Page) => page.frameLocator("iframe[title='Skills Library']");
const openFromLauncher = async (page: Page) => (await showLauncher(page)).getByRole("button", { name: "Skills Library" }).click();

/** Installs the Skills Library Module from its .zip; the Host then shows its View, with an empty Library. */
async function install(page: Page) {
  await dropFile(page, "skills-library.zip", skillsLibrary);
  await page.getByRole("dialog", { name: "Install Skills Library?" }).getByRole("button", { name: "Accept and install" }).click();
  await view(page).getByText(/^No skills yet/).waitFor();
}

interface StoredSkill {
  id: string;
  name: string;
  sourceUrl?: string;
  description: string;
  quadrant: number;
  ring: string;
  score: number;
  notes: string;
  addedAt: string;
  updatedAt: string;
  archived: boolean;
}

/** A file read while the Host writes it may fail: it is read again. */
async function storedFile(page: Page, name: string): Promise<unknown> {
  for (let tries = 0; ; tries++) {
    try {
      const file = (await readFolder(page, DATA))[name];
      return file ? JSON.parse(file).value : null;
    } catch (error) {
      if (tries === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** Waits until the skills the Host wrote pass `written`, so that a reload cannot cut a write short. */
async function stored(page: Page, written: (skills: StoredSkill[]) => boolean): Promise<StoredSkill[]> {
  for (let tries = 0; tries < 50; tries++) {
    const skills = ((await storedFile(page, "skills.json")) ?? []) as StoredSkill[];
    if (written(skills)) return skills;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not write the change");
}

/** Adds a skill by hand through the dialog. */
async function addByHand(page: Page, name: string, url = "", description = "") {
  await view(page).getByRole("button", { name: "Add manually" }).click();
  const dialog = view(page).getByRole("dialog", { name: "Add a skill" });
  await dialog.getByLabel("Name").fill(name);
  if (url) await dialog.getByLabel("URL").fill(url);
  if (description) await dialog.getByLabel("Description").fill(description);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

describe("the Skills Library sample Module", () => {
  test("a skill added by hand is listed with its defaults, links to its URL, and is kept after a reload", async () => {
    const page = await host.newPage();
    await install(page);

    await addByHand(page, "Grill me", "https://raw.githubusercontent.com/acme/skills/main/grill/SKILL.md", "Questions until it is clear");
    const row = view(page).getByRole("listitem").filter({ hasText: "Grill me" });
    await row.waitFor();
    await row.getByText("Watch", { exact: true }).waitFor();
    await row.getByRole("img", { name: "3 out of 5" }).waitFor();
    assert.equal(await row.getByRole("img", { name: "3 out of 5" }).textContent(), "★★★☆☆");
    await row.getByText("Design & planning").waitFor();
    const link = row.getByRole("link", { name: "Grill me" });
    assert.equal(await link.getAttribute("href"), "https://raw.githubusercontent.com/acme/skills/main/grill/SKILL.md");
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.match((await link.getAttribute("rel")) ?? "", /noopener/);

    const [skill] = await stored(page, (skills) => skills.length === 1);
    assert.equal(skill.name, "Grill me");
    assert.equal(skill.sourceUrl, "https://raw.githubusercontent.com/acme/skills/main/grill/SKILL.md");
    assert.equal(skill.description, "Questions until it is clear");
    assert.equal(skill.ring, "watch");
    assert.equal(skill.score, 3);
    assert.equal(skill.quadrant, 0);
    assert.equal(skill.notes, "#### À quoi ça sert\n\n#### Pourquoi\n\n#### Comment\n");
    assert.equal(skill.archived, false);
    assert.ok(skill.id);

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("listitem").filter({ hasText: "Grill me" }).waitFor();
  });

  test("a skill without a URL has no link, and the newest skill comes first", async () => {
    const page = await host.newPage();
    await install(page);

    await addByHand(page, "First one");
    await view(page).getByRole("listitem").filter({ hasText: "First one" }).waitFor();
    // The two skills must not share a date.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addByHand(page, "Second one");

    const items = view(page).getByRole("listitem");
    await items.nth(1).waitFor();
    assert.equal(await items.count(), 2);
    assert.match((await items.nth(0).textContent()) ?? "", /Second one/);
    assert.match((await items.nth(1).textContent()) ?? "", /First one/);
    assert.equal(await view(page).getByRole("link", { name: "First one" }).count(), 0);
    assert.equal(await view(page).getByRole("link", { name: "Second one" }).count(), 0);
  });

  test("a name is required to add a skill", async () => {
    const page = await host.newPage();
    await install(page);
    await view(page).getByRole("button", { name: "Add manually" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Add a skill" });
    await dialog.getByLabel("URL").fill("https://example.com/x");
    assert.ok(await dialog.getByRole("button", { name: "Add", exact: true }).isDisabled());
  });

  test("the View has three tabs, and the one left open is reopened after a reload", async () => {
    const page = await host.newPage();
    await install(page);

    const tabs = view(page).getByRole("tablist");
    assert.deepEqual(await tabs.getByRole("tab").allTextContents(), ["Library", "Radar", "Editions"]);
    assert.equal(await tabs.getByRole("tab", { name: "Library" }).getAttribute("aria-selected"), "true");

    await tabs.getByRole("tab", { name: "Radar" }).click();
    assert.equal(await tabs.getByRole("tab", { name: "Radar" }).getAttribute("aria-selected"), "true");
    await view(page).getByRole("tabpanel").getByText(/coming soon/i).waitFor();
    for (let tries = 0; tries < 50; tries++) {
      if (((await storedFile(page, "settings.json")) as { tab?: string } | null)?.tab === "radar") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("tab", { name: "Radar", selected: true }).waitFor();
  });

  test("the Widget counts the skills and opens the View", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Counted");
    await stored(page, (skills) => skills.length === 1);

    await page.reload();
    const widget = page.frameLocator("iframe[title='Skills Library widget']");
    await widget.getByText("1 skill").waitFor();
    await widget.getByRole("button", { name: /Open/ }).click();
    await view(page).getByRole("listitem").filter({ hasText: "Counted" }).waitFor();
  });
});
