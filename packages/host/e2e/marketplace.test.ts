import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildIndex, type Entry, sha256 } from "@tessello/marketplace";
import type { Page } from "playwright";
import {
  dropFile,
  exampleFiles,
  installLink,
  marketplaceAt,
  readFolder,
  registry,
  registryWhere,
  showLauncher,
  until,
  useHost,
  useMarketplaceServer,
  usePackageServer,
  writeFolder,
  zip,
  zipExample,
} from "./browser.ts";

const host = useHost();
const packages = usePackageServer();
const marketplace = useMarketplaceServer();

const SCREENSHOT = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==", "base64"),
);

/**
 * Publishes a Marketplace listing Notes, with the package of Notes 1.1.0 the index describes, and serves `served` as
 * that package (by default the same bytes). Returns the package's URL and its SHA-256.
 */
async function publishNotes(served?: Uint8Array) {
  const notes = await zipExample("notes");
  const { cors: url } = packages.serve("notes.zip", served ?? notes);
  const hash = await sha256(notes);
  const { index, assets } = await buildIndex({
    listings: [
      {
        entry: {
          id: "@craftskillz/notes",
          source: "https://github.com/craftskillz/notes",
          license: "MIT",
          screenshots: ["main.png"],
          versions: [{ version: "1.1.0", url, sha256: hash }],
        },
        files: new Map([["main.png", SCREENSHOT]]),
      },
      {
        entry: {
          id: "@yassine/weather",
          source: "https://github.com/yassine/weather",
          license: "MIT",
          versions: [{ version: "1.0.0", url: `${packages.url}/cors/weather.zip`, sha256: "0".repeat(64) }],
        },
        files: new Map(),
      },
    ],
    packages: new Map([["@craftskillz/notes@1.1.0", notes]]),
    generatedAt: new Date("2026-05-01T08:30:00Z"),
  });
  marketplace.offline = false;
  marketplace.publish(index, assets);
  return { url, hash };
}

/** Opens the Marketplace from the Launcher, once its list (or its message) is shown. */
const openMarketplace = async (page: Page) => {
  await openLauncher(page, "Marketplace");
  await page.getByRole("heading", { name: "Marketplace", level: 1 }).waitFor();
  await page.getByRole("searchbox").or(page.getByRole("status")).first().waitFor();
};

/** Clicks a button of the Launcher: behind a screen it is a drawer, which comes back when the pointer enters the left edge. */
const openLauncher = async (page: Page, name: string) => {
  await page.mouse.move(600, 300);
  await (await showLauncher(page)).getByRole("button", { name, exact: true }).click();
};

describe("the Marketplace screen", () => {
  test("search, the listing, then installing from the screen shows the warning, runs the Module and records its provenance", async () => {
    const { hash } = await publishNotes();
    const page = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await openMarketplace(page);

    const screen = page.getByRole("region", { name: "Marketplace" });
    assert.equal(await screen.getByRole("button", { name: /Notes/ }).count(), 1);
    await screen.getByRole("searchbox", { name: "Search" }).fill("zzz");
    assert.equal(await screen.getByRole("button", { name: /Notes/ }).count(), 0);
    await screen.getByRole("searchbox", { name: "Search" }).fill("jot");
    // The icon of the result is the index's asset.
    const icon = screen.getByRole("button", { name: /Notes/ }).getByRole("img");
    assert.match((await icon.getAttribute("src"))!, new RegExp(`^${marketplace.url}/modules/craftskillz/notes/1\\.1\\.0/icon\\.svg$`));
    // Styled: the icon of a card is small, and the Launcher stays beside the screen.
    assert.ok((await icon.boundingBox())!.width <= 64);
    assert.ok(await page.getByRole("navigation", { name: "Launcher" }).isVisible());
    await screen.getByRole("combobox", { name: "Permissions" }).selectOption("none");
    assert.equal(await screen.getByRole("button", { name: /Notes/ }).count(), 1);
    await screen.getByRole("button", { name: /Notes/ }).click();

    const listing = page.getByRole("region", { name: "Notes", exact: true });
    const text = await listing.innerText();
    assert.match(text, /@craftskillz/);
    assert.match(text, /MIT/);
    assert.match(text, /Admitted to the Marketplace at its first publication\. Updates are not reviewed\. The Creator answers for this code, and you install it at your own risk\./);
    assert.equal(await listing.getByRole("link", { name: /github\.com\/craftskillz\/notes/ }).getAttribute("target"), "_blank");
    assert.equal(await listing.getByRole("img", { name: /Screenshot/ }).count(), 1);
    await page.frameLocator("iframe[title='Notes: User guide']").getByRole("heading", { name: "Write a note" }).waitFor();

    await listing.getByRole("button", { name: "Install" }).click();
    const accept = page.getByRole("dialog", { name: "Install Notes?" });
    await accept.waitFor();
    assert.match(await accept.innerText(), /Admitted to the Marketplace at its first publication/);
    await accept.getByRole("button", { name: "Accept and install" }).click();

    await page.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
    const installed = await registryWhere(page, "the Module to be registered", (current) => current.modules[0]?.provenance);
    assert.deepEqual(installed.modules[0].provenance, { source: "marketplace", version: "1.1.0", sha256: hash });
  });

  test("a package that no longer matches the index is refused, and nothing is installed", async () => {
    await publishNotes(zip({ ...(await exampleFiles("notes")), "extra.txt": "changed" }));
    const page = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await openMarketplace(page);
    await page.getByRole("button", { name: /Notes/ }).click();
    await page.getByRole("region", { name: "Notes", exact: true }).getByRole("button", { name: "Install" }).click();

    const refusal = page.getByRole("dialog", { name: "Notes can't be installed" });
    await refusal.waitFor();
    assert.match(await refusal.innerText(), /This package no longer matches the Marketplace/);
    assert.equal(await (await showLauncher(page)).getByRole("listitem").count(), 0);
    assert.equal((await readFolder(page, "modules/.tessello"))["modules.json"] ?? "{}", "{}");
  });

  test("when the Marketplace cannot be reached, the screen shows the last copy and its date", async () => {
    await publishNotes();
    const page = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await openMarketplace(page);
    await page.getByRole("button", { name: /Notes/ }).waitFor();
    assert.equal(await page.getByText(/Offline: showing the Marketplace as of/).count(), 0);

    marketplace.offline = true;
    await openLauncher(page, "Tessello");
    await openMarketplace(page);
    await page.getByText(/Offline: showing the Marketplace as of .*\d{4}/).waitFor();
    assert.equal(await page.getByRole("button", { name: /Notes/ }).count(), 1);
  });

  test("without access and without a copy, the screen says so", async () => {
    await publishNotes();
    marketplace.offline = true;
    const page = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await openMarketplace(page);
    await page.getByText("The Marketplace can't be reached", { exact: false }).waitFor();
  });

  test("an install link whose URL and hash are the index's records the provenance; a dropped .zip of the same Module does not", async () => {
    const { url, hash } = await publishNotes();
    const linked = await host.newPage({ init: marketplaceAt(marketplace.indexUrl), hash: installLink(url) });
    const preview = linked.getByRole("dialog", { name: "Install Notes?" });
    await preview.waitFor();
    await preview.getByRole("button", { name: "Accept and install" }).click();
    await linked.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
    const linkedRegistry = await registryWhere(linked, "the Module to be registered", (current) => current.modules[0]?.provenance);
    assert.deepEqual(linkedRegistry.modules[0].provenance, { source: "marketplace", version: "1.1.0", sha256: hash });

    const dropped = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await dropFile(dropped, "notes.zip", await zipExample("notes"));
    const local = dropped.getByRole("dialog", { name: "Install Notes?" });
    await local.waitFor();
    assert.doesNotMatch(await local.innerText(), /Admitted to the Marketplace/);
    await local.getByRole("button", { name: "Accept and install" }).click();
    await dropped.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
    const droppedRegistry = await registryWhere(dropped, "the Module to be registered", (current) => current.modules.length);
    assert.equal(droppedRegistry.modules[0].provenance, undefined);
  });

  test("the screen is in French when the User chose French", async () => {
    await publishNotes();
    const page = await host.newPage({ init: `${marketplaceAt(marketplace.indexUrl)} localStorage.setItem("tessello.language", "fr");`, choose: false });
    await page.getByRole("button", { name: "Choisir un dossier…" }).click();
    await page.getByRole("navigation", { name: "Lanceur" }).waitFor();
    await page.getByRole("button", { name: "Marketplace" }).click();
    await page.getByRole("button", { name: /Notes/ }).click();
    const text = await page.getByRole("region", { name: "Notes", exact: true }).innerText();
    assert.match(text, /Admis dans la Marketplace à sa première publication\. Les mises à jour ne sont pas relues\. Le Créateur répond de ce code, et vous l’installez à vos risques\./);
  });
});

describe("what the Host tells of the Modules installed from the Marketplace", () => {
  /** Notes 1.1.0 installed from the Marketplace screen: the page, and the URL and SHA-256 of its package. */
  async function installNotes() {
    const published = await publishNotes();
    const page = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await openMarketplace(page);
    await page.getByRole("button", { name: /Notes/ }).click();
    await page.getByRole("region", { name: "Notes", exact: true }).getByRole("button", { name: "Install" }).click();
    await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    await page.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
    return { page, ...published };
  }

  /** Publishes Notes 1.2.0 after the installed 1.1.0, with `change` made to the listing first, such as a Ban. */
  async function publishNewerNotes(installed: { url: string; hash: string }, change: (entry: Entry) => void = () => {}) {
    const files = await exampleFiles("notes");
    const manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString("utf8"));
    const next = zip({ ...files, "manifest.json": { ...manifest, version: "1.2.0" } });
    const { cors: url } = packages.serve("notes-1.2.0.zip", next);
    const entry: Entry = {
      id: "@craftskillz/notes",
      source: "https://github.com/craftskillz/notes",
      license: "MIT",
      versions: [
        { version: "1.1.0", url: installed.url, sha256: installed.hash },
        { version: "1.2.0", url, sha256: await sha256(next) },
      ],
    };
    change(entry);
    const { index, assets } = await buildIndex({
      listings: [{ entry, files: new Map() }],
      packages: new Map([["@craftskillz/notes@1.2.0", next]]),
      generatedAt: new Date(),
    });
    marketplace.publish(index, assets);
  }

  /** Opens the Host again a day after its copy of the index was received: its start reads the index again. */
  async function startNextDay(page: Page, launcher = "Launcher") {
    const copy = JSON.parse(await until(async () => (await readFolder(page, "modules/.tessello"))["marketplace.json"], "the copy of the index to be written"));
    await writeFolder(page, "modules/.tessello", { "marketplace.json": { ...copy, receivedAt: "2026-01-01T00:00:00.000Z" } });
    await page.reload();
    await page.getByRole("navigation", { name: launcher }).waitFor();
  }

  test("a newer version gives an update badge in the Launcher, and only its click updates, through the usual update", async () => {
    const { page, ...installed } = await installNotes();
    await publishNewerNotes(installed);
    await startNextDay(page);
    const launcher = await showLauncher(page);
    const badge = launcher.getByRole("button", { name: "Update to 1.2.0" });
    await badge.waitFor();
    assert.equal((await registry(page)).modules[0].version, "1.1.0");

    await badge.click();
    const update = page.getByRole("dialog", { name: "Update Notes?" });
    await update.waitFor();
    assert.match(await update.innerText(), /Admitted to the Marketplace at its first publication/);
    await update.getByRole("button", { name: "Update", exact: true }).click();
    await update.waitFor({ state: "hidden" });
    const [module] = (await registryWhere(page, "the update to be written", (current) => current.modules[0]?.version === "1.2.0")).modules;
    assert.equal(module.version, "1.2.0");
    assert.equal(module.provenance?.version, "1.2.0");
    await (await showLauncher(page)).getByRole("button", { name: "Update to 1.2.0" }).waitFor({ state: "detached" });
  });

  test("a banned version gives a warning in the Launcher and on the Widget, with its reason, and the Module keeps working", async () => {
    const { page, ...installed } = await installNotes();
    await publishNewerNotes(installed, (entry) => (entry.versions[0].banned = "Sends your notes away."));
    await startNextDay(page);
    await (await showLauncher(page)).getByRole("button", { name: "Banned" }).waitFor();
    // The warning says all: no separate update badge.
    assert.equal(await page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Update to 1.2.0" }).count(), 0);

    const widget = page.getByRole("listitem", { name: "Notes" });
    await page.frameLocator("iframe[title='Notes widget']").locator("body").waitFor();
    await widget.getByRole("button", { name: "Banned" }).click();
    const warning = page.getByRole("dialog", { name: "Notes 1.1.0 is banned from the Marketplace" });
    await warning.waitFor();
    const text = await warning.innerText();
    assert.match(text, /Sends your notes away\./);
    assert.match(text, /Notes keeps working: Tessello never uninstalls a Module for you/);
    assert.match(text, /Version 1\.2\.0 is not banned: updating to it is recommended\./);
    assert.equal(await warning.getByRole("button", { name: "Uninstall…" }).count(), 1);
    assert.equal((await registry(page)).modules.length, 1);

    await warning.getByRole("button", { name: "Update to 1.2.0" }).click();
    const update = page.getByRole("dialog", { name: "Update Notes?" });
    await update.getByRole("button", { name: "Update", exact: true }).click();
    await update.waitFor({ state: "hidden" });
    await widget.getByRole("button", { name: "Banned" }).waitFor({ state: "detached" });
    await registryWhere(page, "the update to be written", (current) => current.modules[0]?.version === "1.2.0");
  });

  test("a withdrawn Module gives a neutral note, in French when the User chose French", async () => {
    const { page, ...installed } = await installNotes();
    await publishNewerNotes(installed, (entry) => (entry.withdrawn = true));
    await page.evaluate(() => localStorage.setItem("tessello.language", "fr"));
    await startNextDay(page, "Lanceur");
    await page.getByRole("listitem", { name: "Notes" }).getByRole("button", { name: "Retiré" }).click();
    const note = page.getByRole("dialog", { name: "Notes a été retiré de la Marketplace" });
    await note.waitFor();
    assert.match(await note.innerText(), /Son Créateur l’a retiré\u00a0: la Marketplace ne le propose plus, ni aucune mise à jour\./);
    assert.equal(await page.getByRole("button", { name: /^Mettre à jour en/ }).count(), 0);
  });
});
