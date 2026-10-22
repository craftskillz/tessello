import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import matter from "gray-matter";
import type { Locator, Page } from "playwright";
import { dropFile, readFolder, showLauncher, useHost, writeFolder, zipSample } from "./browser.ts";

const host = useHost();

let skillsLibrary: Uint8Array;
before(async () => {
  skillsLibrary = await zipSample("skills-library");
});

const DATA = "modules/.tessello/data/@craftskillz/skills-library";

const view = (page: Page) => page.frameLocator("iframe[title='Skills Library']");
const goHome = async (page: Page) => (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
const openFromLauncher = async (page: Page) => (await showLauncher(page)).getByRole("button", { name: "Skills Library" }).click();

/** Installs the Skills Library Module from its .zip; the Host then shows its View, with an empty Library. */
async function install(page: Page) {
  await dropFile(page, "skills-library.zip", skillsLibrary);
  await page.getByRole("dialog", { name: "Install Skills Library?" }).getByRole("button", { name: "Accept and install" }).click();
  await view(page).getByText(/^No sets yet/).waitFor();
}

interface StoredSkill {
  id: string;
  name: string;
  sourceUrl?: string;
  description: string;
  score?: number;
  notes: string;
  addedAt: string;
}

interface StoredSet {
  id: string;
  name: string;
  sourceUrl?: string;
  description: string;
  quadrant: number;
  ring: string;
  notes: string;
  skills: StoredSkill[];
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

/** Waits until the sets the Host wrote pass `written`, so that a reload cannot cut a write short. */
async function stored(page: Page, written: (sets: StoredSet[]) => boolean): Promise<StoredSet[]> {
  for (let tries = 0; tries < 50; tries++) {
    const sets = ((await storedFile(page, "sets.json")) ?? []) as StoredSet[];
    if (written(sets)) return sets;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not write the change");
}

/** Adds a set by hand through the dialog; its panel then opens. */
async function addByHand(page: Page, name: string, url = "", description = "") {
  await view(page).getByRole("button", { name: "New set" }).click();
  const dialog = view(page).getByRole("dialog", { name: "New set" });
  await dialog.getByLabel("Name").fill(name);
  if (url) await dialog.getByLabel("URL").fill(url);
  if (description) await dialog.getByLabel("Description").fill(description);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

/** The field of the set in its panel, not the one of a skill: the fields of the set are the direct children of the body. */
const setField = (panel: Locator, label: string) => panel.locator(".sl-panel-body > label").filter({ hasText: new RegExp(`^${label}`) }).locator("input, textarea, select");

/** Adds a skill to the set whose panel is open, through the dialog; its section then unfolds. */
async function addSkill(page: Page, panel: Locator, name: string, url = "", description = "") {
  await panel.getByRole("button", { name: "Add skill" }).click();
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
  test("a set added by hand is listed with its defaults, links to its URL, and is kept after a reload", async () => {
    const page = await host.newPage();
    await install(page);

    await addByHand(page, "Grill me", "https://raw.githubusercontent.com/acme/skills/main/grill/SKILL.md", "Questions until it is clear");
    const row = view(page).getByRole("listitem").filter({ hasText: "Grill me" });
    await row.waitFor();
    await row.getByText("Watch", { exact: true }).waitFor();
    await row.getByText("0 skills", { exact: true }).waitFor();
    await row.getByText("Design & planning").waitFor();
    const link = row.getByRole("link", { name: "Grill me" });
    assert.equal(await link.getAttribute("href"), "https://raw.githubusercontent.com/acme/skills/main/grill/SKILL.md");
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.match((await link.getAttribute("rel")) ?? "", /noopener/);

    const [set] = await stored(page, (sets) => sets.length === 1);
    assert.equal(set.name, "Grill me");
    assert.equal(set.sourceUrl, "https://raw.githubusercontent.com/acme/skills/main/grill/SKILL.md");
    assert.equal(set.description, "Questions until it is clear");
    assert.equal(set.ring, "watch");
    assert.equal(set.quadrant, 0);
    assert.equal(set.notes, "");
    assert.deepEqual(set.skills, []);
    assert.equal(set.archived, false);
    assert.ok(set.id);

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("listitem").filter({ hasText: "Grill me" }).waitFor();
  });

  test("a set without a URL has no link, and the newest set comes first", async () => {
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

  test("a name is required to add a set", async () => {
    const page = await host.newPage();
    await install(page);
    await view(page).getByRole("button", { name: "New set" }).click();
    const dialog = view(page).getByRole("dialog", { name: "New set" });
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
    await view(page).getByRole("tabpanel").getByText(/^Nothing to draw yet/).waitFor();
    for (let tries = 0; tries < 50; tries++) {
      if (((await storedFile(page, "settings.json")) as { tab?: string } | null)?.tab === "radar") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("tab", { name: "Radar", selected: true }).waitFor();

    await view(page).getByRole("tab", { name: "Editions" }).click();
    await view(page).getByRole("tabpanel").getByText(/^No edition yet/).waitFor();
  });

  test("the Widget counts the sets per ring, counts the changes waiting, and opens the View", async () => {
    const page = await host.newPage();
    await install(page);
    const widget = page.frameLocator("iframe[title='Skills Library widget']");
    const ring = (name: string) => widget.getByRole("listitem").filter({ hasText: name });
    await goHome(page);
    await widget.getByText("No edition yet").waitFor();
    await ring("Recommended").getByText("0", { exact: true }).waitFor();

    // Back to the View, two sets are added; the Widget, hidden meanwhile, reads them again when the Home comes back.
    await openFromLauncher(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await addJudged(page, "Bravo", "Watch", "Code & tests");
    await goHome(page);
    await ring("Try").getByText("1", { exact: true }).waitFor();
    await ring("Watch").getByText("1", { exact: true }).waitFor();
    await ring("Recommended").getByText("0", { exact: true }).waitFor();
    await widget.getByText("2 changes waiting").waitFor();
    assert.ok(
      await widget.locator("body").evaluate((body) => body.scrollHeight <= innerHeight && body.scrollWidth <= innerWidth),
      "the Widget does not scroll",
    );

    // Publishing brings the counter back to zero and dates the last edition.
    await openFromLauncher(page);
    await publishEdition(page, 1);
    await goHome(page);
    await widget.getByText(/^Last edition: /).waitFor();
    assert.equal(await widget.getByText(/changes? waiting/).count(), 0);

    // Moving a set puts it back up, and the set follows its new ring.
    await openFromLauncher(page);
    await libraryTab(page);
    const panel = await openPanel(page, "Alpha");
    await panel.getByRole("radio", { name: "Recommended" }).check();
    await panel.getByRole("button", { name: "Close" }).click();
    await goHome(page);
    await widget.getByText("1 change waiting").waitFor();
    await ring("Recommended").getByText("1", { exact: true }).waitFor();
    await ring("Try").getByText("0", { exact: true }).waitFor();

    await widget.getByRole("button", { name: /Open/ }).click();
    await view(page).getByRole("listitem").filter({ hasText: "Alpha" }).waitFor();
  });

  test("the URL of a skill folder, entered, adds a set of one skill with the name and the description read from its SKILL.md", async () => {
    const page = await host.newPage();
    const requests = await fakeGitHub(page);
    await install(page);

    await pasteField(page).fill("https://github.com/acme/skills/tree/main/grill-me");
    await pasteField(page).press("Enter");
    const row = view(page).getByRole("listitem").filter({ hasText: "grill-me" });
    await row.waitFor();
    assert.equal(await pasteField(page).inputValue(), "", "the field is emptied for the next URL");

    const [set] = await stored(page, (sets) => sets.length === 1);
    assert.equal(set.name, "grill-me");
    assert.equal(set.description, "Interviews you relentlessly about a plan.");
    assert.equal(set.sourceUrl, "https://github.com/acme/skills/tree/main/grill-me");
    assert.equal(set.skills.length, 1);
    assert.equal(set.skills[0].name, "grill-me");
    assert.equal(set.skills[0].description, "Interviews you relentlessly about a plan.");
    assert.equal(set.skills[0].sourceUrl, "https://github.com/acme/skills/tree/main/grill-me");
    assert.equal(set.skills[0].score, undefined, "not evaluated");
    await view(page).getByRole("listitem").filter({ hasText: "grill-me" }).getByText("1 skill (not evaluated)").waitFor();
    assert.deepEqual(requests, ["https://raw.githubusercontent.com/acme/skills/main/grill-me/SKILL.md"]);
  });

  test("a pasted URL adds the skill at once", async () => {
    const page = await host.newPage();
    await fakeGitHub(page);
    await install(page);

    await pasteField(page).focus();
    await paste(page, "github.com/acme/skills/blob/main/grill-me/SKILL.md");
    await view(page).getByRole("listitem").filter({ hasText: "grill-me" }).waitFor();
    const [set] = await stored(page, (sets) => sets.length === 1);
    assert.equal(set.sourceUrl, "https://github.com/acme/skills/tree/main/grill-me");
  });

  test("the same set entered again adds nothing, reads nothing, and says it is there", async () => {
    const page = await host.newPage();
    const requests = await fakeGitHub(page);
    await install(page);
    await pasteField(page).fill("https://github.com/acme/skills/tree/main/grill-me");
    await pasteField(page).press("Enter");
    await view(page).getByRole("listitem").filter({ hasText: "grill-me" }).waitFor();
    await stored(page, (sets) => sets.length === 1);

    // Its file, with another case for the owner.
    await pasteField(page).fill("https://github.com/ACME/skills/blob/main/grill-me/SKILL.md");
    await pasteField(page).press("Enter");
    await view(page).getByText("Already in your Library.").waitFor();
    assert.equal(await view(page).getByRole("listitem").count(), 1);
    assert.equal(requests.length, 1, "nothing more was read");
    assert.equal((await stored(page, () => true)).length, 1);
  });

  test("a skill that cannot be found says so, and New set opens the dialog with the URL", async () => {
    const page = await host.newPage();
    await fakeGitHub(page);
    await install(page);

    await pasteField(page).fill("https://github.com/acme/skills/tree/main/unknown");
    await pasteField(page).press("Enter");
    await view(page).getByText("No SKILL.md was found at this URL.").waitFor();
    await view(page).getByRole("status").getByRole("button", { name: "New set" }).click();
    const dialog = view(page).getByRole("dialog", { name: "New set" });
    assert.equal(await dialog.getByLabel("URL").inputValue(), "https://github.com/acme/skills/tree/main/unknown");
    await dialog.getByLabel("Name").fill("Unknown");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await view(page).getByRole("listitem").filter({ hasText: "Unknown" }).waitFor();
    const [set] = await stored(page, (sets) => sets.length === 1);
    assert.equal(set.sourceUrl, "https://github.com/acme/skills/tree/main/unknown");
  });

  test("a URL that is not a skill on GitHub says so, and New set keeps what was typed", async () => {
    const page = await host.newPage();
    const requests = await fakeGitHub(page);
    await install(page);

    await pasteField(page).fill("https://example.com/x");
    await pasteField(page).press("Enter");
    await view(page).getByText("This is not the GitHub URL of a skill.").waitFor();
    await view(page).getByRole("status").getByRole("button", { name: "New set" }).click();
    assert.equal(await view(page).getByRole("dialog", { name: "New set" }).getByLabel("URL").inputValue(), "https://example.com/x");
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

  test("a set added by hand with a URL that is there already adds nothing", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Grill me", "https://github.com/acme/skills/tree/main/grill-me");
    await view(page).getByRole("listitem").filter({ hasText: "Grill me" }).waitFor();

    await view(page).getByRole("button", { name: "New set" }).click();
    const dialog = view(page).getByRole("dialog", { name: "New set" });
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

  test("a click on a set opens its panel, where each change is saved at once; Escape closes it", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Grill me");
    await stored(page, (sets) => sets.length === 1);

    // The panel opens for the skill just added, and from a click on its row.
    await panelOf(page, "Grill me").waitFor();
    await page.keyboard.press("Escape");
    await panelOf(page, "Grill me").waitFor({ state: "hidden" });
    await view(page).getByRole("listitem").getByText("Design & planning").click();
    const panel = panelOf(page, "Grill me");
    await panel.waitFor();

    await panel.getByLabel("Description").fill("Questions until it is clear");
    await panel.getByRole("radio", { name: "Recommended" }).check();
    await panel.getByLabel("Quadrant").selectOption({ label: "Code & tests" });
    await panel.getByLabel("Set notes").fill("# Great\n\nUse it **often**.");

    const [set] = await stored(page, ([item]) => item?.ring === "recommended" && item.quadrant === 1 && item.notes.startsWith("# Great") && item.description !== "");
    assert.equal(set.description, "Questions until it is clear");
    assert.ok(set.updatedAt > set.addedAt);

    // The list shows the changes behind the panel.
    const row = view(page).getByRole("listitem").filter({ hasText: "Grill me" });
    await row.getByText("Recommended", { exact: true }).waitFor();
    await row.getByText("Code & tests").waitFor();

    await panel.getByRole("button", { name: "Close" }).click();
    await panel.waitFor({ state: "hidden" });
  });

  test("the score of a skill is set with the keyboard, and cleared: the skill is not evaluated again", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Keys");
    const panel = panelOf(page, "Keys");
    await addSkill(page, panel, "Typing");
    await panel.getByText("Not evaluated").first().waitFor();
    await panel.getByRole("radio", { name: "1 out of 5" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    assert.ok(await panel.getByRole("radio", { name: "3 out of 5" }).isChecked());
    await stored(page, ([item]) => item?.skills[0]?.score === 3);
    await view(page).getByRole("listitem").filter({ hasText: "Keys" }).getByText("1 skill", { exact: true }).waitFor();

    await panel.getByRole("button", { name: "Clear", exact: true }).click();
    await panel.getByRole("button", { name: "Clear", exact: true }).waitFor({ state: "detached" });
    const [set] = await stored(page, ([item]) => item?.skills[0]?.score === undefined);
    assert.equal(set.skills[0].score, undefined);
    await view(page).getByRole("listitem").filter({ hasText: "Keys" }).getByText("1 skill (not evaluated)").waitFor();
  });

  test("a blank name, notes over 8,000 characters and the URL of another set are refused with a message", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Taken", "https://example.com/taken");
    await panelOf(page, "Taken").getByRole("button", { name: "Close" }).click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addByHand(page, "Mine");
    await stored(page, (sets) => sets.length === 2);
    const panel = panelOf(page, "Mine");
    await panel.waitFor();

    await setField(panel, "Name").fill("");
    await panel.getByText("A name is required.").waitFor();
    await setField(panel, "Name").fill("Mine, renamed");
    await panel.getByText("A name is required.").waitFor({ state: "hidden" });
    await panelOf(page, "Mine, renamed").waitFor();

    await setField(panel, "Set notes").fill("x".repeat(8001));
    await panel.getByText("Notes are limited to 8,000 characters.").waitFor();
    assert.equal((await setField(panel, "Set notes").inputValue()).length, 8001, "what was typed is kept to be trimmed");
    await setField(panel, "Set notes").fill("x".repeat(8000));
    await panel.getByText("Notes are limited to 8,000 characters.").waitFor({ state: "hidden" });

    await setField(panel, "URL").fill("https://example.com/taken/");
    await setField(panel, "URL").blur();
    await panel.getByText("Another set already has this URL.").waitFor();

    const sets = await stored(page, (list) => list.some((item) => item.notes === "x".repeat(8000)));
    const mine = sets.find((item) => item.name === "Mine, renamed");
    assert.ok(mine);
    assert.equal(mine.sourceUrl, undefined, "the refused URL was not saved");
    assert.equal(sets.length, 2);
  });

  test("the quadrants are renamed, the Library is filtered and searched, and all of it is kept after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Élégant plan");
    await stored(page, (sets) => sets.length === 1);
    const panel = panelOf(page, "Élégant plan");
    await panel.getByRole("radio", { name: "Try" }).check();
    await panel.getByLabel("Quadrant").selectOption({ label: "Writing & docs" });
    await addSkill(page, panel, "Zebra crossing");
    await panel.getByRole("radio", { name: "4 out of 5" }).check({ force: true });
    await setField(panel, "Set notes").fill("kept");
    await panel.getByRole("button", { name: "Close" }).click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addByHand(page, "Other thing");
    await panelOf(page, "Other thing").getByRole("button", { name: "Close" }).click();
    const before = await stored(page, (sets) => sets.length === 2 && sets.some((item) => item.notes === "kept" && item.quadrant === 2 && item.ring === "try" && item.skills[0]?.score === 4));
    const plan = before.find((item) => item.name === "Élégant plan")!;
    assert.ok(plan.updatedAt > plan.addedAt);

    // Renaming a quadrant changes the name shown, and no set's quadrant.
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
    await view(page).getByLabel("Search by set or skill name").fill("ELEGANT");
    assert.equal(await items.count(), 1);
    await view(page).getByLabel("Search by set or skill name").fill("nothing like it");
    await view(page).getByText("No set matches these filters.").waitFor();
    // The name of one of its skills finds a set too.
    await view(page).getByLabel("Search by set or skill name").fill("ZEBRA");
    await items.first().waitFor();
    assert.equal(await items.count(), 1);
    await view(page).getByLabel("Search by set or skill name").fill("elegant");
    await items.first().waitFor();

    const settings = await storedSettings(page, (value) => value.quadrants?.[2] === "Prose" && value.filters?.query === "elegant");
    assert.deepEqual(settings.filters, { rings: [], quadrants: [2], query: "elegant", archived: false });
    assert.deepEqual(settings.quadrants, ["Design & planning", "Code & tests", "Prose", "Tooling & workflow"]);
    const after = await stored(page, () => true);
    assert.deepEqual(after.map((item) => item.quadrant).sort(), [0, 2], "renaming moved no set");

    await page.reload();
    await openFromLauncher(page);
    assert.equal(await view(page).getByLabel("Search by set or skill name").inputValue(), "elegant");
    assert.equal(await view(page).getByRole("button", { name: "Prose", exact: true }).getAttribute("aria-pressed"), "true");
    await items.first().waitFor();
    assert.equal(await items.count(), 1);
    const reopened = await openPanel(page, "Élégant plan");
    assert.ok(await reopened.getByRole("radio", { name: "Try" }).isChecked());
    await reopened.locator("summary", { hasText: "Zebra crossing" }).click();
    assert.ok(await reopened.getByRole("radio", { name: "4 out of 5" }).isChecked());
    assert.equal(await reopened.getByLabel("Quadrant").inputValue(), "2");
    assert.equal(await setField(reopened, "Set notes").inputValue(), "kept");
  });

  test("a set added while the filters hide it clears them, so that its row is shown", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "First");
    await panelOf(page, "First").getByRole("button", { name: "Close" }).click();
    await view(page).getByRole("button", { name: "Try", exact: true }).click();
    await view(page).getByText("No set matches these filters.").waitFor();

    await addByHand(page, "Hidden by the filter");
    await view(page).getByRole("listitem").filter({ hasText: "Hidden by the filter" }).waitFor();
    assert.equal(await view(page).getByRole("button", { name: "Try", exact: true }).getAttribute("aria-pressed"), "false");
  });

  // Archiving and deleting a skill (skills-library ticket 04).

  test("an archived set leaves the Library, shows greyed with the switch, and comes back when unarchived", async () => {
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

  test("when every set is archived, the Library does not say that it is empty", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Only one");
    await panelOf(page, "Only one").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Only one").getByRole("button", { name: "Close" }).click();
    await view(page).getByText("No set matches these filters.").waitFor();
    await view(page).getByLabel("Show archived").waitFor();
  });

  test("a set is deleted only after the User confirms it", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "By mistake");
    const panel = panelOf(page, "By mistake");
    await panel.getByRole("button", { name: "Delete" }).click();
    const confirmation = view(page).getByRole("dialog", { name: "Delete By mistake?" });
    await confirmation.waitFor();

    // Escape closes the confirmation only; Cancel keeps the set.
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
    await view(page).getByText(/^No sets yet/).waitFor();
    await stored(page, (list) => list.length === 0);
  });

  test("a URL already in the Library as an archived set shows that set, switching the archived on", async () => {
    const page = await host.newPage();
    await install(page);
    const url = "https://github.com/acme/skills/tree/main/grill-me";
    await addByHand(page, "Grill me", url);
    await panelOf(page, "Grill me").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Grill me").getByRole("button", { name: "Close" }).click();
    await view(page).getByText("No set matches these filters.").waitFor();

    await addByHand(page, "Again", url);
    const row = view(page).getByRole("listitem").filter({ hasText: "Grill me" });
    await row.waitFor();
    assert.ok(await view(page).getByLabel("Show archived").isChecked());
    assert.ok((await row.getAttribute("class"))?.includes("sl-highlighted"));
    assert.equal((await stored(page, () => true)).length, 1);
  });

  // The radar (skills-library ticket 05).

  /** Adds a set and puts it in a ring and a quadrant, through its panel. */
  async function addJudged(page: Page, name: string, ring: string, quadrant: string) {
    await addByHand(page, name);
    const panel = panelOf(page, name);
    await panel.waitFor();
    await panel.getByRole("radio", { name: ring }).check();
    await panel.getByLabel("Quadrant").selectOption({ label: quadrant });
    await panel.getByRole("button", { name: "Close" }).click();
    await panel.waitFor({ state: "hidden" });
  }

  const radarTab = (page: Page) => view(page).getByRole("tab", { name: "Radar" }).click();
  const dots = (page: Page) => view(page).locator("svg [data-set-id]");
  /** The distance of a skill's dot from the centre of the radar, which is (260, 270) in the drawing. */
  async function distanceOf(page: Page, name: string) {
    const transform = await view(page).locator("svg [data-set-id]").filter({ has: page.locator(`title`, { hasText: name }) }).first().getAttribute("transform");
    const [x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(transform ?? "")!.slice(1).map(Number);
    return Math.hypot(x - 260, y - 270);
  }
  /** The ring (0 to 3, from the centre) a distance falls in. */
  const ringAt = (distance: number) => [0.38, 0.58, 0.8, 1].findIndex((end) => distance <= end * 230);

  test("the radar draws a point per set, numbers them in a legend, lists them as new, and drops an archived set", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Recommended", "Design & planning");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addJudged(page, "Bravo", "Try", "Code & tests");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addJudged(page, "Charlie", "Deprecated", "Tooling & workflow");
    await stored(page, (sets) => sets.length === 3 && sets.some((item) => item.ring === "deprecated"));

    await radarTab(page);
    await dots(page).nth(2).waitFor();
    assert.equal(await dots(page).count(), 3);
    const legend = view(page).getByRole("button", { name: /^\d+\. / });
    assert.deepEqual(await legend.allTextContents(), ["1. Alpha — Recommended", "2. Bravo — Try", "3. Charlie — Deprecated"]);
    await view(page).getByText("3 changes waiting").waitFor();
    const waiting = view(page).getByRole("list", { name: "Changes waiting" });
    assert.equal(await waiting.getByText("New", { exact: true }).count(), 3);

    await view(page).getByRole("tab", { name: "Library" }).click();
    await view(page).getByRole("button", { name: "Edit Bravo" }).click();
    await panelOf(page, "Bravo").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Bravo").getByRole("button", { name: "Close" }).click();
    await radarTab(page);
    await view(page).getByText("2 changes waiting").waitFor();
    assert.equal(await dots(page).count(), 2);
  });

  test("changing the ring of a set moves its point to the band of the new ring", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Mover", "Watch", "Code & tests");
    await radarTab(page);
    await dots(page).first().waitFor();
    assert.equal(ringAt(await distanceOf(page, "Mover")), 2);

    await view(page).getByRole("tab", { name: "Library" }).click();
    await openPanel(page, "Mover");
    await panelOf(page, "Mover").getByRole("radio", { name: "Recommended" }).check();
    await panelOf(page, "Mover").getByRole("button", { name: "Close" }).click();
    await radarTab(page);
    await dots(page).first().waitFor();
    assert.equal(ringAt(await distanceOf(page, "Mover")), 0);
  });

  test("a click on a point, or on a line of the legend, opens the set in the Library", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await addJudged(page, "Bravo", "Watch", "Code & tests");
    await radarTab(page);
    await dots(page).nth(1).waitFor();

    await dots(page).filter({ has: page.locator("title", { hasText: "Bravo" }) }).first().click();
    await panelOf(page, "Bravo").waitFor();
    await view(page).getByRole("tab", { name: "Library", selected: true }).waitFor();
    await panelOf(page, "Bravo").getByRole("button", { name: "Close" }).click();

    await radarTab(page);
    await view(page).getByRole("button", { name: /^1\. Alpha/ }).click();
    await panelOf(page, "Alpha").waitFor();
    await view(page).getByRole("tab", { name: "Library", selected: true }).waitFor();
  });

  test("the radar fits a 360 px wide screen, without a horizontal scroll", async () => {
    const page = await host.newPage();
    await page.setViewportSize({ width: 360, height: 800 });
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await radarTab(page);
    await dots(page).first().waitFor();

    const svg = await view(page).locator(".sl-radar svg").boundingBox();
    assert.ok(svg && svg.width > 200 && svg.width <= 360, `the radar is ${svg?.width} px wide`);
    const overflow = await view(page).locator("html").evaluate((html) => html.scrollWidth - html.clientWidth);
    assert.ok(overflow <= 0, `the page overflows by ${overflow} px`);
  });

  // Editions (skills-library ticket 06).

  /** Publishes the next edition from the Radar tab, through the dialog. */
  async function publishEdition(page: Page, number: number, intro = "Hello **world**") {
    await radarTab(page);
    await view(page).getByRole("button", { name: `Publish edition ${number}`, exact: true }).click();
    const dialog = view(page).getByRole("dialog", { name: `Publish edition ${number}`, exact: true });
    await dialog.getByLabel("Introduction").fill(intro);
    await dialog.getByRole("button", { name: "Next" }).click();
    await view(page).getByRole("dialog", { name: `Publish edition ${number}?`, exact: true }).getByRole("button", { name: "Publish", exact: true }).click();
    await view(page).getByRole("dialog").waitFor({ state: "hidden" });
  }

  const libraryTab = (page: Page) => view(page).getByRole("tab", { name: "Library" }).click();

  test("an edition is published with its introduction; a moved set must be explained before the next one; the editions are listed after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await addJudged(page, "Bravo", "Watch", "Code & tests");
    await radarTab(page);

    // The introduction is required.
    await view(page).getByRole("button", { name: "Publish edition 1", exact: true }).click();
    const first = view(page).getByRole("dialog", { name: "Publish edition 1", exact: true });
    assert.equal(await first.getByRole("button", { name: "Next" }).isDisabled(), true);
    await first.getByLabel("Introduction").fill("   ");
    assert.equal(await first.getByRole("button", { name: "Next" }).isDisabled(), true);
    await first.getByRole("button", { name: "Cancel" }).click();
    await first.waitFor({ state: "hidden" });

    await publishEdition(page, 1, "First edition");
    await view(page).getByText("No change waiting").waitFor();
    await view(page).getByRole("button", { name: "Publish edition 2", exact: true }).waitFor();

    // Alpha moves: the next edition is refused until the move is explained.
    await libraryTab(page);
    await openPanel(page, "Alpha");
    await panelOf(page, "Alpha").getByRole("radio", { name: "Recommended" }).check();
    await panelOf(page, "Alpha").getByRole("button", { name: "Close" }).click();
    await openPanel(page, "Bravo");
    await panelOf(page, "Bravo").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Bravo").getByRole("button", { name: "Close" }).click();
    await radarTab(page);
    await view(page).getByText("2 changes waiting").waitFor();
    await view(page).getByText("Moved: Try → Recommended").waitFor();
    await view(page).getByText("Retired (was Watch)").waitFor();

    await view(page).getByRole("button", { name: "Publish edition 2", exact: true }).click();
    const refused = view(page).getByRole("dialog", { name: "Publish edition 2", exact: true });
    assert.equal(await refused.getByLabel("Introduction").count(), 0);
    assert.equal(await refused.getByRole("button", { name: "Publish", exact: true }).count(), 0);
    await refused.getByRole("button", { name: "Alpha" }).click();
    await refused.waitFor({ state: "hidden" });
    const panel = panelOf(page, "Alpha");
    await panel.waitFor();
    await panel.getByLabel("Why did it move?").fill("Used it for a month");
    await panel.getByRole("button", { name: "Close" }).click();

    await publishEdition(page, 2, "Second edition");
    await view(page).getByText("No change waiting").waitFor();
    await stored(page, (sets) => sets.every((set) => !("moveReason" in set)));
    await new Promise((resolve) => setTimeout(resolve, 200));

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("tab", { name: "Editions" }).click();
    const headings = view(page).getByRole("heading", { name: /^Edition \d+$/ });
    await headings.nth(1).waitFor();
    assert.deepEqual(await headings.allTextContents(), ["Edition 2", "Edition 1"]);
    // Edition 2 has Alpha (Recommended) only, since Bravo was archived; Edition 1 had one Try and one Watch.
    await view(page).getByText("1 Recommended", { exact: true }).waitFor();
    await view(page).getByText("1 Try · 1 Watch", { exact: true }).waitFor();
  });

  /** The file the View hands the User when `start` runs: its name and its bytes. */
  async function downloaded(page: Page, start: () => Promise<void>): Promise<{ name: string; bytes: Buffer }> {
    const [file] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), start()]);
    return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
  }

  test("the .zip of an edition holds its post for the blog and its cover, for any edition", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await addJudged(page, "Bravo", "Watch", "Code & tests");
    await publishEdition(page, 1, "First edition");
    await libraryTab(page);
    await openPanel(page, "Alpha");
    await panelOf(page, "Alpha").getByRole("radio", { name: "Recommended" }).check();
    await panelOf(page, "Alpha").getByLabel("Why did it move?").fill("Used it for a month");
    await panelOf(page, "Alpha").getByRole("button", { name: "Close" }).click();
    await openPanel(page, "Bravo");
    await panelOf(page, "Bravo").getByRole("button", { name: "Archive", exact: true }).click();
    await panelOf(page, "Bravo").getByRole("button", { name: "Close" }).click();
    await publishEdition(page, 2, "Second edition");
    await view(page).getByRole("tab", { name: "Editions" }).click();

    const zipOf = async (n: number) => {
      const file = await downloaded(page, () => view(page).getByRole("button", { name: `Download edition ${n} as .zip` }).click());
      assert.equal(file.name, `skills-radar-edition-${n}.zip`);
      const files = unzipSync(new Uint8Array(file.bytes));
      const slug = `skills-radar-edition-${n}`;
      assert.deepEqual(Object.keys(files).sort(), [`_posts/${slug}.md`, `public/assets/blog/${slug}/cover.png`]);
      const cover = Buffer.from(files[`public/assets/blog/${slug}/cover.png`]);
      assert.deepEqual([...cover.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "the cover is a PNG");
      assert.deepEqual([cover.readUInt32BE(16), cover.readUInt32BE(20)], [1200, 630]);
      const post = matter(strFromU8(files[`_posts/${slug}.md`]));
      assert.equal(post.data.title, `Skills Radar — Édition ${n}`);
      assert.equal(post.data.coverImage, `/assets/blog/${slug}/cover.png`);
      assert.equal(post.data.ogImage.url, `/assets/blog/${slug}/cover.png`);
      assert.match(String(post.data.date instanceof Date ? post.data.date.toISOString() : post.data.date), /^\d{4}-\d{2}-\d{2}/);
      return post.content;
    };

    const first = await zipOf(1);
    assert.match(first, /First edition/);
    assert.match(first, /## Ce qui bouge/);
    assert.match(first, /### 1\. Alpha/);
    assert.match(first, /### 2\. Bravo/);
    assert.doesNotMatch(first, /## Retirés du radar/);

    const second = await zipOf(2);
    assert.match(second, /Second edition/);
    assert.match(second, /Déplacé : À essayer → Recommandé/);
    assert.match(second, /Used it for a month/);
    assert.match(second, /## Retirés du radar\n\n- Bravo — À surveiller/);
  });

  test("the Editions tab says so when nothing is published", async () => {
    const page = await host.newPage();
    await install(page);
    await view(page).getByRole("tab", { name: "Editions" }).click();
    await view(page).getByText("No edition yet. Publish one from the Radar.").waitFor();
  });

  test("a published set offers Archive only; the explanation of a move is asked only while the ring differs from the published one", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await addJudged(page, "Bravo", "Watch", "Code & tests");
    await openPanel(page, "Alpha");
    assert.equal(await panelOf(page, "Alpha").getByRole("button", { name: "Delete" }).count(), 1);
    await panelOf(page, "Alpha").getByRole("button", { name: "Close" }).click();
    await publishEdition(page, 1);
    await libraryTab(page);

    const panel = await openPanel(page, "Alpha");
    await panel.getByRole("button", { name: "Archive", exact: true }).waitFor();
    assert.equal(await panel.getByRole("button", { name: "Delete" }).count(), 0);
    assert.equal(await panel.getByLabel("Why did it move?").count(), 0);

    await panel.getByRole("radio", { name: "Recommended" }).check();
    await panel.getByLabel("Why did it move?").fill("Typed");
    await panel.getByRole("radio", { name: "Try" }).check();
    await panel.getByLabel("Why did it move?").waitFor({ state: "detached" });
    await panel.getByRole("radio", { name: "Watch" }).check();
    assert.equal(await panel.getByLabel("Why did it move?").inputValue(), "");
  });

  test("the explanation of a move is limited to 280 characters", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await publishEdition(page, 1);
    await libraryTab(page);
    const panel = await openPanel(page, "Alpha");
    await panel.getByRole("radio", { name: "Recommended" }).check();
    const field = panel.getByLabel("Why did it move?");
    assert.equal(await field.getAttribute("maxlength"), "280");
    await field.fill("x".repeat(300));
    assert.equal((await field.inputValue()).length, 280);
    assert.equal(await panel.getByRole("alert").count(), 0);
  });

  test("an edition is stored under its own key, then the index of the editions", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await publishEdition(page, 1, "Stored intro");
    let files: string[] = [];
    for (let tries = 0; tries < 50; tries++) {
      files = Object.keys(await readFolder(page, DATA));
      if (files.some((name) => /^edition.*1/.test(name)) && files.includes("editions.json")) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const name = files.find((file) => /^edition.*1/.test(file));
    assert.ok(name && files.includes("editions.json"), `files: ${files.join(", ")}`);
    const edition = (await storedFile(page, name)) as { number: number; intro: string; entries: { name: string; ring: string }[] };
    assert.equal(edition.number, 1);
    assert.equal(edition.intro, "Stored intro");
    assert.deepEqual(edition.entries.map((entry) => [entry.name, entry.ring]), [["Alpha", "try"]]);
    const index = (await storedFile(page, "editions.json")) as { number: number; counts: Record<string, number> }[];
    assert.deepEqual(index.map((item) => [item.number, item.counts.try]), [[1, 1]]);
  });

  test("the publish dialog fits a 360 px wide screen", async () => {
    const page = await host.newPage();
    await page.setViewportSize({ width: 360, height: 800 });
    await install(page);
    await addJudged(page, "Alpha", "Try", "Design & planning");
    await radarTab(page);
    await view(page).getByRole("button", { name: "Publish edition 1", exact: true }).click();
    const dialog = view(page).getByRole("dialog", { name: "Publish edition 1", exact: true });
    await dialog.getByLabel("Introduction").fill("Hi");
    const box = await dialog.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 360, `the dialog is at ${box?.x}, ${box?.width} px wide`);
    const overflow = await view(page).locator("html").evaluate((html) => html.scrollWidth - html.clientWidth);
    assert.ok(overflow <= 0, `the page overflows by ${overflow} px`);
  });

  // The sets, end to end (skills-library ticket 11).

  const section = (panel: Locator, name: string) => panel.locator("details", { hasText: name });

  test("a storage in the old model is migrated into sets of one skill, with no change waiting, and the old edition still downloads", async () => {
    const page = await host.newPage();
    await install(page);
    const quadrants = ["Design & planning", "Code & tests", "Writing & docs", "Tooling & workflow"];
    const legacy = (id: string, name: string, ring: string, quadrant: number, score: number, notes: string) => ({
      id,
      name,
      description: `About ${name}`,
      quadrant,
      ring,
      score,
      notes,
      addedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      archived: false,
    });
    const alpha = legacy("legacy-a", "Alpha", "try", 0, 4, "Notes of Alpha");
    const bravo = legacy("legacy-b", "Bravo", "watch", 1, 2, "Notes of Bravo");
    const publishedAt = "2026-02-01T00:00:00.000Z";
    const entry = (skill: typeof alpha) => ({
      id: skill.id,
      name: skill.name,
      quadrant: skill.quadrant,
      ring: skill.ring,
      change: "new",
      description: skill.description,
      score: skill.score,
      notes: skill.notes,
    });
    await writeFolder(page, DATA, {
      "skills.json": { key: "skills", value: [alpha, bravo] },
      "editions.json": { key: "editions", value: [{ number: 1, publishedAt, counts: { recommended: 0, try: 1, watch: 1, deprecated: 0 } }] },
      "edition%3A1.json": {
        key: "edition:1",
        value: { number: 1, publishedAt, intro: "Old edition", quadrants, entries: [entry(alpha), entry(bravo)], retired: [] },
      },
    });
    await page.reload();
    await openFromLauncher(page);

    const items = view(page).getByRole("listitem");
    await items.nth(1).waitFor();
    assert.equal(await items.count(), 2);
    for (const name of ["Alpha", "Bravo"]) await items.filter({ hasText: name }).getByText("1 skill", { exact: true }).waitFor();
    assert.equal(await view(page).getByText("Updated", { exact: true }).count(), 0);
    assert.equal(await view(page).getByText("New", { exact: true }).count(), 0, "no pending change");

    const sets = await stored(page, (list) => list.length === 2);
    const migrated = sets.find((set) => set.id === "legacy-a")!;
    assert.equal(migrated.ring, "try");
    assert.equal(migrated.notes, "");
    assert.equal(migrated.skills.length, 1);
    assert.equal(migrated.skills[0].score, 4);
    assert.equal(migrated.skills[0].notes, "Notes of Alpha");
    const files = await readFolder(page, DATA);
    assert.deepEqual(JSON.parse(files["skills.json"]).value, [alpha, bravo], "the old skills are left as they were");

    await radarTab(page);
    await view(page).getByText("No change waiting").waitFor();
    await view(page).getByRole("tab", { name: "Editions" }).click();
    await view(page).getByText("1 Try · 1 Watch", { exact: true }).waitFor();
    const file = await downloaded(page, () => view(page).getByRole("button", { name: "Download edition 1 as .zip" }).click());
    assert.equal(file.name, "skills-radar-edition-1.zip");
    const post = strFromU8(unzipSync(new Uint8Array(file.bytes))["_posts/skills-radar-edition-1.md"]);
    assert.match(post, /Old edition/);
    assert.match(post, /### 1\. Alpha/);
    assert.match(post, /### 2\. Bravo/);
  });

  test("a set made by hand takes two skills, one of them scored; published, it is updated when a skill is removed", async () => {
    const page = await host.newPage();
    await install(page);
    await addByHand(page, "Bundle");
    const panel = panelOf(page, "Bundle");
    await addSkill(page, panel, "Alpha skill", "https://example.com/alpha", "The first");
    await addSkill(page, panel, "Beta skill");
    // The same URL in the same set is refused; in another set it would be accepted.
    await panel.getByRole("button", { name: "Add skill" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Add a skill" });
    await dialog.getByLabel("Name").fill("Again");
    await dialog.getByLabel("URL").fill("https://example.com/alpha");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByText("Another skill of this set already has this URL.").waitFor();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    const first = section(panel, "Alpha skill");
    await first.locator("summary").click();
    await first.getByRole("radio", { name: "5 out of 5" }).check({ force: true });
    const [set] = await stored(page, ([item]) => item?.skills.length === 2 && item.skills[0].score === 5);
    assert.deepEqual(set.skills.map((skill) => skill.name), ["Alpha skill", "Beta skill"]);
    assert.equal(set.skills[1].score, undefined);
    assert.equal(set.skills[0].notes, "#### À quoi ça sert\n\n#### Pourquoi\n\n#### Comment\n");
    const row = view(page).getByRole("listitem").filter({ hasText: "Bundle" });
    await row.getByText("2 skills (1 not evaluated)").waitFor();
    await row.getByText("New", { exact: true }).waitFor();

    await panel.getByRole("button", { name: "Close" }).click();
    await publishEdition(page, 1, "A set");
    await libraryTab(page);
    await row.getByText("New", { exact: true }).waitFor({ state: "detached" });

    // Removing a skill is allowed after the publication, behind a confirmation.
    await openPanel(page, "Bundle");
    const beta = section(panel, "Beta skill");
    await beta.locator("summary").click();
    await beta.getByRole("button", { name: "Remove from set" }).click();
    const confirmation = view(page).getByRole("dialog", { name: "Remove Beta skill from the set?" });
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await confirmation.waitFor({ state: "hidden" });
    assert.equal((await stored(page, () => true))[0].skills.length, 2);
    await beta.getByRole("button", { name: "Remove from set" }).click();
    await confirmation.getByRole("button", { name: "Remove from set" }).click();
    await stored(page, ([item]) => item?.skills.length === 1);
    await panel.getByRole("button", { name: "Close" }).click();
    await row.getByText("Updated", { exact: true }).waitFor();
    await row.getByText("1 skill", { exact: true }).waitFor();
    await radarTab(page);
    await view(page).getByText("No change waiting").waitFor();
  });

  test("a set that moved is explained before the next edition, which counts the sets per ring", async () => {
    const page = await host.newPage();
    await install(page);
    await addJudged(page, "Bundle", "Try", "Design & planning");
    await publishEdition(page, 1, "First");
    await libraryTab(page);
    const panel = await openPanel(page, "Bundle");
    await panel.getByRole("radio", { name: "Recommended" }).check();
    await panel.getByRole("button", { name: "Close" }).click();
    await radarTab(page);
    await view(page).getByText("1 change waiting").waitFor();
    await view(page).getByText("Moved: Try → Recommended").waitFor();

    await view(page).getByRole("button", { name: "Publish edition 2", exact: true }).click();
    const refused = view(page).getByRole("dialog", { name: "Publish edition 2", exact: true });
    await refused.getByRole("button", { name: "Bundle" }).click();
    await panelOf(page, "Bundle").getByLabel("Why did it move?").fill("It earned it");
    await panelOf(page, "Bundle").getByRole("button", { name: "Close" }).click();
    await publishEdition(page, 2, "Second");
    await view(page).getByRole("tab", { name: "Editions" }).click();
    await view(page).getByText("1 Recommended", { exact: true }).waitFor();
    await view(page).getByText("1 Try", { exact: true }).waitFor();
  });
});
