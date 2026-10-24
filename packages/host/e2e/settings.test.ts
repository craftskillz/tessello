// The theme and the language of the interface, chosen in the Settings and given to the Modules (CONVENTION.md §6.2,
// §6.4).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, showLauncher, showLauncherTools, useHost, zip } from "./browser.ts";

const host = useHost();

/** Shows the mode of the theme and the locale it was given, and follows `theme.changed`. */
const PROBE = `<p>Mode: <span id="mode">?</span></p><p>Locale: <span id="locale">?</span></p>
<script>
  addEventListener("message", ({ data }) => {
    if (data?.tessello !== 1) return;
    if (data.type === "response" && data.id === "1") {
      document.getElementById("mode").textContent = data.result.theme.mode;
      document.getElementById("locale").textContent = data.result.locale;
    }
    if (data.type === "theme.changed") document.getElementById("mode").textContent = data.payload.mode;
  });
  parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*");
</script>`;

const LAMP = zip({
  "manifest.json": {
    convention: 1,
    id: "@test/lamp",
    name: "Lamp",
    version: "1.0.0",
    icon: "icon.svg",
    guide: "guide.md",
    view: { entry: "view.html" },
    widget: { entry: "widget.html", size: "M" },
  },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
  "guide.md": "# Lamp",
  "view.html": PROBE,
  "widget.html": PROBE,
});

async function installLamp(page: Page) {
  await dropFile(page, "lamp.zip", LAMP);
  await page.getByRole("dialog", { name: "Install Lamp?" }).getByRole("button", { name: "Accept and install" }).click();
}

const view = (page: Page) => page.frameLocator("iframe[title='Lamp']");
const widget = (page: Page, title = "Lamp widget") => page.frameLocator(`iframe[title='${title}']`);

async function chooseTheme(page: Page, theme: "Same as the system" | "Light" | "Dark") {
  await (await showLauncherTools(page)).getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("radio", { name: theme }).check();
  await settings.getByRole("button", { name: "Close" }).click();
}

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

describe("the theme of the interface", () => {
  test("follows the system until the User chooses one, and every change reaches the Modules shown", async () => {
    const page = await host.newPage();
    await page.emulateMedia({ colorScheme: "dark" });
    await installLamp(page);
    await view(page).getByText("Mode: dark").waitFor();
    assert.equal(await background(page), "rgb(20, 22, 26)");

    await chooseTheme(page, "Light");
    await view(page).getByText("Mode: light").waitFor();
    assert.equal(await background(page), "rgb(255, 255, 255)");

    // The View stays loaded behind the Home: both it and the Widget get the change.
    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
    await widget(page).getByText("Mode: light").waitFor();
    await chooseTheme(page, "Dark");
    await widget(page).getByText("Mode: dark").waitFor();
    await (await showLauncher(page)).getByRole("button", { name: "Lamp", exact: true }).click();
    await view(page).getByText("Mode: dark").waitFor();

    // A choice ignores the system, and is kept.
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).waitFor();
    await widget(page).getByText("Mode: dark").waitFor();

    // Back to the system's: it follows the system as it changes.
    await chooseTheme(page, "Same as the system");
    await widget(page).getByText("Mode: light").waitFor();
    await page.emulateMedia({ colorScheme: "dark" });
    await widget(page).getByText("Mode: dark").waitFor();
  });
});

describe("the language of the interface", () => {
  test("is English by default; French, once chosen, is kept and given to the Modules in their context", async () => {
    const page = await host.newPage();
    await installLamp(page);
    await view(page).getByText("Locale: en").waitFor();

    await (await showLauncherTools(page)).getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog", { name: "Settings" }).getByRole("combobox", { name: "Language" }).selectOption("fr");

    // Tessello restarts in French.
    const launcher = page.getByRole("navigation", { name: "Lanceur" });
    await launcher.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), "fr");
    await widget(page, "Widget Lamp").getByText("Locale: fr").waitFor();
    await launcher.getByRole("button", { name: "Lamp", exact: true }).click();
    await view(page).getByText("Locale: fr").waitFor();
    await showLauncher(page, "Lanceur");
    await page.getByRole("button", { name: "Gérer" }).click();
    await page.getByRole("button", { name: "Réglages" }).click();
    await page.getByRole("dialog", { name: "Réglages" }).getByRole("radio", { name: "Sombre" }).waitFor();

    await page.reload();
    await page.getByRole("navigation", { name: "Lanceur" }).waitFor();
  });
});
