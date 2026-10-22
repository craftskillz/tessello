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

const SKILL_MD = `---
name: grill-me
description: >
  Interviews you relentlessly
  about a plan.
---

# Grill me
`;

/** Fakes raw.githubusercontent.com: `acme/skills/main/grill-me/SKILL.md` exists, anything else is a 404, or the network is down. */
async function fakeGitHub(page: Page, online = { value: true }) {
  const requests: string[] = [];
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    requests.push(route.request().url());
    if (!online.value) return route.abort("internetdisconnected");
    // The Module runs in an opaque origin, which the answer must allow.
    const headers = { "Access-Control-Allow-Origin": "null" };
    if (route.request().url() === "https://raw.githubusercontent.com/acme/skills/main/grill-me/SKILL.md") {
      return route.fulfill({ headers, contentType: "text/plain", body: SKILL_MD });
    }
    return route.fulfill({ headers, status: 404, contentType: "text/plain", body: "404: Not Found" });
  });
  return requests;
}

const pasteField = (page: Page) => view(page).getByLabel("Paste a GitHub URL");

/** Pastes text in the field as the User does: a real paste event carrying the text. */
const paste = (page: Page, text: string) =>
  pasteField(page).evaluate((input, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  }, text);

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

  test("the URL of a skill folder, entered, adds the skill with the name and the description read from its SKILL.md", async () => {
    const page = await host.newPage();
    const requests = await fakeGitHub(page);
    await install(page);

    await pasteField(page).fill("https://github.com/acme/skills/tree/main/grill-me");
    await pasteField(page).press("Enter");
    const row = view(page).getByRole("listitem").filter({ hasText: "grill-me" });
    await row.waitFor();
    assert.equal(await pasteField(page).inputValue(), "", "the field is emptied for the next URL");

    const [skill] = await stored(page, (skills) => skills.length === 1);
    assert.equal(skill.name, "grill-me");
    assert.equal(skill.description, "Interviews you relentlessly about a plan.");
    assert.equal(skill.sourceUrl, "https://github.com/acme/skills/tree/main/grill-me");
    assert.deepEqual(requests, ["https://raw.githubusercontent.com/acme/skills/main/grill-me/SKILL.md"]);
  });

  test("a pasted URL adds the skill at once", async () => {
    const page = await host.newPage();
    await fakeGitHub(page);
    await install(page);

    await pasteField(page).focus();
    await paste(page, "github.com/acme/skills/blob/main/grill-me/SKILL.md");
    await view(page).getByRole("listitem").filter({ hasText: "grill-me" }).waitFor();
    const [skill] = await stored(page, (skills) => skills.length === 1);
    assert.equal(skill.sourceUrl, "https://github.com/acme/skills/tree/main/grill-me");
  });

  test("the same skill entered again adds nothing, reads nothing, and says it is there", async () => {
    const page = await host.newPage();
    const requests = await fakeGitHub(page);
    await install(page);
    await pasteField(page).fill("https://github.com/acme/skills/tree/main/grill-me");
    await pasteField(page).press("Enter");
    await view(page).getByRole("listitem").filter({ hasText: "grill-me" }).waitFor();
    await stored(page, (skills) => skills.length === 1);

    // Its file, with another case for the owner.
    await pasteField(page).fill("https://github.com/ACME/skills/blob/main/grill-me/SKILL.md");
    await pasteField(page).press("Enter");
    await view(page).getByText("Already in your Library.").waitFor();
    assert.equal(await view(page).getByRole("listitem").count(), 1);
    assert.equal(requests.length, 1, "nothing more was read");
    assert.equal((await stored(page, () => true)).length, 1);
  });

  test("a skill that cannot be found says so, and Add manually opens the dialog with the URL", async () => {
    const page = await host.newPage();
    await fakeGitHub(page);
    await install(page);

    await pasteField(page).fill("https://github.com/acme/skills/tree/main/unknown");
    await pasteField(page).press("Enter");
    await view(page).getByText("No SKILL.md was found at this URL.").waitFor();
    await view(page).getByRole("status").getByRole("button", { name: "Add manually" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Add a skill" });
    assert.equal(await dialog.getByLabel("URL").inputValue(), "https://github.com/acme/skills/tree/main/unknown");
    await dialog.getByLabel("Name").fill("Unknown");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await view(page).getByRole("listitem").filter({ hasText: "Unknown" }).waitFor();
    const [skill] = await stored(page, (skills) => skills.length === 1);
    assert.equal(skill.sourceUrl, "https://github.com/acme/skills/tree/main/unknown");
  });

  test("a URL that is not a skill on GitHub says so, and Add manually keeps what was typed", async () => {
    const page = await host.newPage();
    const requests = await fakeGitHub(page);
    await install(page);

    await pasteField(page).fill("https://example.com/x");
    await pasteField(page).press("Enter");
    await view(page).getByText("This is not the GitHub URL of a skill.").waitFor();
    await view(page).getByRole("status").getByRole("button", { name: "Add manually" }).click();
    assert.equal(await view(page).getByRole("dialog", { name: "Add a skill" }).getByLabel("URL").inputValue(), "https://example.com/x");
    assert.deepEqual(requests, []);
  });

  test("a network failure says so, and the message goes at the next input", async () => {
    const page = await host.newPage();
    await fakeGitHub(page, { value: false });
    await install(page);

    await pasteField(page).fill("https://github.com/acme/skills/tree/main/grill-me");
    await pasteField(page).press("Enter");
    const message = view(page).getByText("The SKILL.md could not be read (check your connection).");
    await message.waitFor();
    assert.equal(await view(page).getByRole("listitem").count(), 0);
    await pasteField(page).fill("https://github.com/acme/skills/tree/main/grill-m");
    await message.waitFor({ state: "hidden" });
  });

  test("a skill added by hand with a URL that is there already adds nothing", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Grill me", "https://github.com/acme/skills/tree/main/grill-me");
    await view(page).getByRole("listitem").filter({ hasText: "Grill me" }).waitFor();

    await view(page).getByRole("button", { name: "Add manually" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Add a skill" });
    await dialog.getByLabel("Name").fill("Another");
    await dialog.getByLabel("URL").fill("https://raw.githubusercontent.com/Acme/skills/main/grill-me/SKILL.md");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await view(page).getByText("Already in your Library.").waitFor();
    assert.equal(await view(page).getByRole("listitem").count(), 1);
    assert.equal((await stored(page, () => true)).length, 1);
  });

  // The edit panel, the quadrants and the filters (skills-library ticket 03).

  const panelOf = (page: Page, name: string) => view(page).getByRole("dialog", { name });
  const openPanel = async (page: Page, name: string) => {
    await view(page).getByRole("button", { name: `Edit ${name}` }).click();
    const panel = panelOf(page, name);
    await panel.waitFor();
    return panel;
  };
  /** Waits until the settings the Host wrote pass `written`. */
  async function storedSettings(page: Page, written: (settings: any) => boolean) {
    for (let tries = 0; tries < 50; tries++) {
      const settings = await storedFile(page, "settings.json");
      if (settings && written(settings)) return settings as any;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail("the Host did not write the settings");
  }

  test("a click on a skill opens its panel, where each change is saved at once; Escape closes it", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Grill me");
    await stored(page, (skills) => skills.length === 1);

    // The panel opens for the skill just added, and from a click on its row.
    await panelOf(page, "Grill me").waitFor();
    await page.keyboard.press("Escape");
    await panelOf(page, "Grill me").waitFor({ state: "hidden" });
    await view(page).getByRole("listitem").getByText("Design & planning").click();
    const panel = panelOf(page, "Grill me");
    await panel.waitFor();

    await panel.getByLabel("Description").fill("Questions until it is clear");
    await panel.getByRole("radio", { name: "Recommended" }).check();
    await panel.getByRole("radio", { name: "5 out of 5" }).check({ force: true });
    await panel.getByLabel("Quadrant").selectOption({ label: "Code & tests" });
    await panel.getByLabel("Notes").fill("# Great\n\nUse it **often**.");

    const [skill] = await stored(page, ([item]) => item?.ring === "recommended" && item.score === 5 && item.quadrant === 1 && item.notes.startsWith("# Great") && item.description !== "");
    assert.equal(skill.description, "Questions until it is clear");
    assert.ok(skill.updatedAt > skill.addedAt);

    // The list shows the changes behind the panel.
    const row = view(page).getByRole("listitem").filter({ hasText: "Grill me" });
    await row.getByText("Recommended", { exact: true }).waitFor();
    await row.getByRole("img", { name: "5 out of 5" }).waitFor();
    await row.getByText("Code & tests").waitFor();

    await panel.getByRole("button", { name: "Close" }).click();
    await panel.waitFor({ state: "hidden" });
  });

  test("the score is set with the keyboard", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Keys");
    const panel = panelOf(page, "Keys");
    await panel.waitFor();
    await panel.getByRole("radio", { name: "3 out of 5" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    assert.ok(await panel.getByRole("radio", { name: "5 out of 5" }).isChecked());
    await stored(page, ([item]) => item?.score === 5);
  });

  test("a blank name, notes over 8,000 characters and the URL of another skill are refused with a message", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Taken", "https://example.com/taken");
    await panelOf(page, "Taken").getByRole("button", { name: "Close" }).click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addByHand(page, "Mine");
    await stored(page, (skills) => skills.length === 2);
    const panel = panelOf(page, "Mine");
    await panel.waitFor();

    await panel.getByLabel("Name").fill("");
    await panel.getByText("A name is required.").waitFor();
    await panel.getByLabel("Name").fill("Mine, renamed");
    await panel.getByText("A name is required.").waitFor({ state: "hidden" });
    await panelOf(page, "Mine, renamed").waitFor();

    await panel.getByLabel("Notes").fill("x".repeat(8001));
    await panel.getByText("Notes are limited to 8,000 characters.").waitFor();
    assert.equal((await panel.getByLabel("Notes").inputValue()).length, 8001, "what was typed is kept to be trimmed");
    await panel.getByLabel("Notes").fill("x".repeat(8000));
    await panel.getByText("Notes are limited to 8,000 characters.").waitFor({ state: "hidden" });

    await panel.getByLabel("URL").fill("https://example.com/taken/");
    await panel.getByLabel("URL").blur();
    await panel.getByText("Another skill already has this URL.").waitFor();

    const skills = await stored(page, (list) => list.some((item) => item.notes === "x".repeat(8000)));
    const mine = skills.find((item) => item.name === "Mine, renamed");
    assert.ok(mine);
    assert.equal(mine.sourceUrl, undefined, "the refused URL was not saved");
    assert.equal(skills.length, 2);
  });

  test("the quadrants are renamed, the Library is filtered and searched, and all of it is kept after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Élégant plan");
    await stored(page, (skills) => skills.length === 1);
    const panel = panelOf(page, "Élégant plan");
    await panel.getByRole("radio", { name: "Try" }).check();
    await panel.getByLabel("Quadrant").selectOption({ label: "Writing & docs" });
    await panel.getByRole("radio", { name: "4 out of 5" }).check({ force: true });
    await panel.getByLabel("Notes").fill("kept");
    await panel.getByRole("button", { name: "Close" }).click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addByHand(page, "Other thing");
    await panelOf(page, "Other thing").getByRole("button", { name: "Close" }).click();
    const before = await stored(page, (skills) => skills.length === 2 && skills.some((item) => item.notes === "kept" && item.quadrant === 2 && item.ring === "try" && item.score === 4));
    const plan = before.find((item) => item.name === "Élégant plan")!;
    assert.ok(plan.updatedAt > plan.addedAt);

    // Renaming a quadrant changes the name shown, and no skill's quadrant.
    await view(page).getByRole("button", { name: "Rename quadrants" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Rename quadrants" });
    await dialog.getByLabel("Quadrant 3", { exact: true }).fill("");
    await dialog.getByText("A quadrant name is required.").waitFor();
    await dialog.getByLabel("Quadrant 3", { exact: true }).fill("Prose");
    await dialog.getByText("A quadrant name is required.").waitFor({ state: "hidden" });
    await dialog.getByRole("button", { name: "Close" }).click();
    await view(page).getByRole("listitem").filter({ hasText: "Élégant plan" }).getByText("Prose").waitFor();

    // Filters: a ring, a quadrant, and a search without case or accents.
    const items = view(page).getByRole("listitem");
    await view(page).getByRole("button", { name: "Try", exact: true }).click();
    assert.equal(await view(page).getByRole("button", { name: "Try", exact: true }).getAttribute("aria-pressed"), "true");
    await items.nth(0).waitFor();
    assert.equal(await items.count(), 1);
    await view(page).getByRole("button", { name: "Clear filters" }).click();
    assert.equal(await items.count(), 2);
    await view(page).getByRole("button", { name: "Prose", exact: true }).click();
    assert.equal(await items.count(), 1);
    await view(page).getByLabel("Search by name").fill("ELEGANT");
    assert.equal(await items.count(), 1);
    await view(page).getByLabel("Search by name").fill("nothing like it");
    await view(page).getByText("No skill matches these filters.").waitFor();
    await view(page).getByLabel("Search by name").fill("elegant");
    await items.first().waitFor();

    const settings = await storedSettings(page, (value) => value.quadrants?.[2] === "Prose" && value.filters?.query === "elegant");
    assert.deepEqual(settings.filters, { rings: [], quadrants: [2], query: "elegant", archived: false });
    assert.deepEqual(settings.quadrants, ["Design & planning", "Code & tests", "Prose", "Tooling & workflow"]);
    const after = await stored(page, () => true);
    assert.deepEqual(after.map((item) => item.quadrant).sort(), [0, 2], "renaming moved no skill");

    await page.reload();
    await openFromLauncher(page);
    assert.equal(await view(page).getByLabel("Search by name").inputValue(), "elegant");
    assert.equal(await view(page).getByRole("button", { name: "Prose", exact: true }).getAttribute("aria-pressed"), "true");
    await items.first().waitFor();
    assert.equal(await items.count(), 1);
    const reopened = await openPanel(page, "Élégant plan");
    assert.ok(await reopened.getByRole("radio", { name: "Try" }).isChecked());
    assert.ok(await reopened.getByRole("radio", { name: "4 out of 5" }).isChecked());
    assert.equal(await reopened.getByLabel("Quadrant").inputValue(), "2");
    assert.equal(await reopened.getByLabel("Notes").inputValue(), "kept");
  });

  test("a skill added while the filters hide it clears them, so that its row is shown", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "First");
    await panelOf(page, "First").getByRole("button", { name: "Close" }).click();
    await view(page).getByRole("button", { name: "Try", exact: true }).click();
    await view(page).getByText("No skill matches these filters.").waitFor();

    await addByHand(page, "Hidden by the filter");
    await view(page).getByRole("listitem").filter({ hasText: "Hidden by the filter" }).waitFor();
    assert.equal(await view(page).getByRole("button", { name: "Try", exact: true }).getAttribute("aria-pressed"), "false");
  });

  // Archiving and deleting a skill (skills-library ticket 04).

  test("an archived skill leaves the Library, shows greyed with the switch, and comes back when unarchived", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Keep me");
    await panelOf(page, "Keep me").getByRole("button", { name: "Close" }).click();
    await addByHand(page, "Old idea");
    await panelOf(page, "Old idea").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Old idea").getByRole("button", { name: "Unarchive" }).waitFor();
    await panelOf(page, "Old idea").getByRole("button", { name: "Close" }).click();

    const items = view(page).getByRole("listitem");
    await items.filter({ hasText: "Keep me" }).waitFor();
    assert.equal(await items.count(), 1);
    assert.equal((await stored(page, (list) => list.some((item) => item.name === "Old idea" && item.archived))).length, 2);

    await view(page).getByLabel("Show archived").check();
    const row = items.filter({ hasText: "Old idea" });
    await row.waitFor();
    assert.ok((await row.getAttribute("class"))?.includes("sl-archived"));
    await row.getByText("Archived", { exact: true }).waitFor();
    assert.ok(!(await items.filter({ hasText: "Keep me" }).getAttribute("class"))?.includes("sl-archived"));
    await storedSettings(page, (value) => value.filters?.archived === true);

    // The switch is remembered.
    await page.reload();
    await openFromLauncher(page);
    await view(page).getByLabel("Show archived").waitFor();
    assert.ok(await view(page).getByLabel("Show archived").isChecked());
    await items.filter({ hasText: "Old idea" }).waitFor();

    const panel = await openPanel(page, "Old idea");
    await panel.getByRole("button", { name: "Unarchive" }).click();
    await panel.getByRole("button", { name: "Archive", exact: true }).waitFor();
    await stored(page, (list) => list.every((item) => !item.archived));
    await view(page).getByLabel("Show archived").uncheck();
    await items.filter({ hasText: "Old idea" }).waitFor();
    assert.equal(await items.count(), 2);
  });

  test("when every skill is archived, the Library does not say that it is empty", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Only one");
    await panelOf(page, "Only one").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Only one").getByRole("button", { name: "Close" }).click();
    await view(page).getByText("No skill matches these filters.").waitFor();
    await view(page).getByLabel("Show archived").waitFor();
  });

  test("a skill is deleted only after the User confirms it", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "By mistake");
    const panel = panelOf(page, "By mistake");
    await panel.getByRole("button", { name: "Delete" }).click();
    const confirmation = view(page).getByRole("dialog", { name: "Delete By mistake?" });
    await confirmation.waitFor();

    // Escape closes the confirmation only; Cancel keeps the skill.
    await page.keyboard.press("Escape");
    await confirmation.waitFor({ state: "hidden" });
    await panel.waitFor();
    await panel.getByRole("button", { name: "Delete" }).click();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await confirmation.waitFor({ state: "hidden" });
    assert.equal((await stored(page, () => true)).length, 1);

    await panel.getByRole("button", { name: "Delete" }).click();
    await confirmation.getByRole("button", { name: "Delete" }).click();
    await panel.waitFor({ state: "hidden" });
    await view(page).getByText(/^No skills yet/).waitFor();
    await stored(page, (list) => list.length === 0);
  });

  test("a URL already in the Library as an archived skill shows that skill, switching the archived on", async () => {
    const page = await host.newPage();
    await install(page);
    const url = "https://github.com/acme/skills/tree/main/grill-me";
    await addByHand(page, "Grill me", url);
    await panelOf(page, "Grill me").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Grill me").getByRole("button", { name: "Close" }).click();
    await view(page).getByText("No skill matches these filters.").waitFor();

    await addByHand(page, "Again", url);
    const row = view(page).getByRole("listitem").filter({ hasText: "Grill me" });
    await row.waitFor();
    assert.ok(await view(page).getByLabel("Show archived").isChecked());
    assert.ok((await row.getAttribute("class"))?.includes("sl-highlighted"));
    assert.equal((await stored(page, () => true)).length, 1);
  });
});
