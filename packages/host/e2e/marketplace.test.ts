import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildIndex, sha256 } from "@tessello/marketplace";
import type { Page } from "playwright";
import {
  dropFile,
  exampleFiles,
  installLink,
  marketplaceAt,
  readFolder,
  showLauncher,
  useHost,
  useMarketplaceServer,
  usePackageServer,
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

const registry = async (page: Page) => JSON.parse((await readFolder(page, "modules/.tessello"))["modules.json"]);

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
    assert.deepEqual((await registry(page)).modules[0].provenance, { source: "marketplace", version: "1.1.0", sha256: hash });
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
    assert.deepEqual((await registry(linked)).modules[0].provenance, { source: "marketplace", version: "1.1.0", sha256: hash });

    const dropped = await host.newPage({ init: marketplaceAt(marketplace.indexUrl) });
    await dropFile(dropped, "notes.zip", await zipExample("notes"));
    const local = dropped.getByRole("dialog", { name: "Install Notes?" });
    await local.waitFor();
    assert.doesNotMatch(await local.innerText(), /Admitted to the Marketplace/);
    await local.getByRole("button", { name: "Accept and install" }).click();
    await dropped.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
    assert.equal((await registry(dropped)).modules[0].provenance, undefined);
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
