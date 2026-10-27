// The contract test of each @craftskillz Module: its published package (`fixtures/<name>.zip`) works in the Host. No
// test of the Module's own repository can prove it, as they run without the Host: sandbox, CSP, Permissions,
// handshake, Modules folder. The Module's features are tested in its repository. A new @craftskillz Module gets its
// contract with one entry in CONTRACTS.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import type { FrameLocator, Locator, Page } from "playwright";
import { dropFile, moduleFixture, readFolder, showLauncher, until, useHost } from "./browser.ts";

const host = useHost();

interface Contract {
  /** The package: `fixtures/<fixture>.zip`. */
  fixture: string;
  /** Answers the servers the Module declares, in place of the real ones: a request reaches it once the Host lets it through. */
  network?: (page: Page) => Promise<void>;
  /** Waits until the View has started: it shows its first screen once its handshake is done. */
  started: (view: FrameLocator) => Promise<void>;
  /** Changes something in the View, which it writes in its storage; through the declared network, if there is one. */
  write: (view: FrameLocator, page: Page) => Promise<void>;
  /** Whether the storage of the Module, as the Host wrote it in the Modules folder (key → value), holds that change. */
  written: (storage: Record<string, any>) => boolean;
  /** Waits until a View started afresh shows that change again. */
  readBack: (view: FrameLocator) => Promise<void>;
  widget: WidgetContract;
}

interface WidgetContract {
  /** Waits until the Widget shows the change the View wrote. */
  shows: (widget: FrameLocator) => Promise<void>;
  /** Opens the View from the Widget, and waits until the View shows what it was opened on, with the params of `openView` if any. */
  opensView: (widget: FrameLocator, view: FrameLocator) => Promise<void>;
}

/** A 1×1 PNG. */
const DOT = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
/** The Modules run in an opaque origin, which an answer from another server must allow. */
const CORS = { "Access-Control-Allow-Origin": "null" };

/** Waits until a locator matches a visible element; through `until`, the one deadline of every wait in this file. */
async function shown(locator: Locator): Promise<void> {
  await until(() => locator.isVisible(), `${locator} to show`);
}

/** Whether an image has loaded its picture. */
const loaded = (image: Locator) => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);

/** The View shows the diagram titled `title`. */
const diagramOpened = (view: FrameLocator, title: string) =>
  until(async () => (await view.getByRole("textbox", { name: "Diagram title" }).inputValue()) === title, `the View to open “${title}”`);

const CONTRACTS: Contract[] = [
  {
    fixture: "survival-kit",
    started: (view) => shown(view.getByRole("heading", { name: "myTasks." })),
    async write(view) {
      await view.getByRole("textbox", { name: "New task" }).fill("Renew the certificate");
      await view.getByRole("combobox", { name: "Priority" }).selectOption({ label: "Urgent" });
      await view.getByRole("button", { name: "Add task" }).click();
    },
    written: (storage) => storage.tasks?.some((task: any) => task.text === "Renew the certificate"),
    readBack: (view) => shown(view.getByRole("checkbox", { name: "Renew the certificate" })),
    widget: {
      shows: (widget) => shown(widget.getByRole("checkbox", { name: "Renew the certificate" })),
      async opensView(widget, view) {
        await widget.getByRole("button", { name: "1 urgent" }).click();
        await shown(view.locator("button[aria-pressed='true']", { hasText: "Urgent" }));
      },
    },
  },
  {
    fixture: "watch-later",
    async network(page) {
      await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/png", body: DOT }));
      await page.route("https://www.youtube.com/oembed**", (route) =>
        route.fulfill({ headers: CORS, contentType: "application/json", body: JSON.stringify({ title: "Never Gonna Give You Up", author_name: "Rick Astley", type: "video" }) }),
      );
    },
    started: (view) => shown(view.getByText(/^No videos yet/)),
    async write(view) {
      const field = view.getByRole("textbox", { name: "Paste a YouTube URL" });
      await field.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      await field.press("Enter");
      // The title comes from oEmbed, and the thumbnail from i.ytimg.com: the Host let both requests through.
      await shown(view.getByRole("link", { name: "Never Gonna Give You Up", exact: true }));
      const thumbnail = view.getByRole("img", { name: "Thumbnail of Never Gonna Give You Up" });
      await until(() => loaded(thumbnail), "the thumbnail to load");
    },
    written: (storage) => storage.videos?.some((video: any) => video.videoId === "dQw4w9WgXcQ" && video.metaStatus === "ok"),
    readBack: (view) => shown(view.getByRole("link", { name: "Never Gonna Give You Up", exact: true })),
    widget: {
      shows: (widget) => shown(widget.getByRole("link", { name: "Never Gonna Give You Up" })),
      async opensView(widget, view) {
        await widget.getByRole("button", { name: "Open ↗" }).click();
        await shown(view.getByRole("article").filter({ hasText: "Never Gonna Give You Up" }));
      },
    },
  },
  {
    fixture: "skills-library",
    async network(page) {
      await page.route("https://raw.githubusercontent.com/**", (route) =>
        route.request().url() === "https://raw.githubusercontent.com/acme/skills/main/grill-me/SKILL.md"
          ? route.fulfill({ headers: CORS, contentType: "text/plain", body: "---\nname: grill-me\ndescription: Interviews you relentlessly about a plan.\n---\n\n# Grill me\n" })
          : route.fulfill({ headers: CORS, status: 404, contentType: "text/plain", body: "404: Not Found" }),
      );
    },
    started: (view) => shown(view.getByText(/^No sets yet/)),
    async write(view) {
      const field = view.getByLabel("Paste a GitHub URL");
      await field.fill("https://github.com/acme/skills/tree/main/grill-me");
      await field.press("Enter");
      // The description comes from the SKILL.md on raw.githubusercontent.com: the Host let the request through.
      const preview = view.getByRole("dialog", { name: "Import a set" });
      await shown(preview.getByText("Interviews you relentlessly about a plan."));
      await preview.getByRole("button", { name: "Import", exact: true }).click();
    },
    written: (storage) => storage.sets?.some((set: any) => set.name === "grill-me" && set.skills.length === 1),
    readBack: (view) => shown(view.getByRole("listitem").filter({ hasText: "grill-me" })),
    widget: {
      shows: (widget) => shown(widget.getByRole("listitem").filter({ hasText: "Watch" }).getByText("1", { exact: true })),
      async opensView(widget, view) {
        await widget.getByRole("button", { name: /Open/ }).click();
        await shown(view.getByRole("listitem").filter({ hasText: "grill-me" }));
      },
    },
  },
  {
    fixture: "diagram",
    started: (view) => shown(view.getByText("Select or create a diagram")),
    async write(view, page) {
      await view.getByRole("navigation", { name: "Diagrams" }).getByRole("button", { name: "+ New" }).click();
      const title = view.getByRole("textbox", { name: "Diagram title" });
      await title.fill("Checkout");
      await title.press("Enter");
      // A rectangle placed by a double-click in the middle of the canvas, with its text.
      await view.getByRole("button", { name: "Rectangle (R)" }).click();
      const box = (await view.getByRole("application", { name: "Canvas" }).boundingBox())!;
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
      const text = view.getByRole("textbox", { name: "Text of the shape" });
      await text.fill("API");
      await text.press("Enter");
    },
    written: (storage) =>
      storage.diagrams?.some((entry: any) => entry.title === "Checkout") &&
      Object.entries(storage).some(([key, diagram]) => key.startsWith("diagram:") && diagram.shapes.some((shape: any) => shape.text === "API")),
    async readBack(view) {
      await shown(view.getByRole("img", { name: "Rectangle API", exact: true }));
      await diagramOpened(view, "Checkout");
    },
    widget: {
      shows: (widget) => shown(widget.getByRole("list", { name: "Recent diagrams" }).getByRole("button", { name: /^Checkout/ })),
      async opensView(widget, view) {
        await widget.getByRole("list", { name: "Recent diagrams" }).getByRole("button", { name: /^Checkout/ }).click();
        await diagramOpened(view, "Checkout");
      },
    },
  },
];

interface Manifest {
  id: string;
  name: string;
  guide: string;
  permissions?: { network?: string[] };
}

/** The package of a Module, its manifest, and how many images its User guide shows. */
async function packageOf(fixture: string) {
  const bytes = await moduleFixture(fixture);
  const files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files["manifest.json"])) as Manifest;
  const images = strFromU8(files[manifest.guide]).match(/!\[/g)?.length ?? 0;
  return { bytes, manifest, images };
}

/** The storage of a Module as the Host wrote it in the Modules folder: key → value. */
async function storageOf(page: Page, id: string): Promise<Record<string, any>> {
  const files = Object.values(await readFolder(page, `modules/.tessello/data/${id}`)).map((file) => JSON.parse(file) as { key: string; value: unknown });
  return Object.fromEntries(files.map((file) => [file.key, file.value]));
}

/** The servers of a Permission as the Host lists them: their host names. */
const serversOf = (manifest: Manifest) => (manifest.permissions?.network ?? []).map((origin) => new URL(origin).host);

/** Asserts that what the Host says a Module can do lists every server it declares, or no network access. */
async function assertPermissions(text: string, manifest: Manifest) {
  const servers = serversOf(manifest);
  if (servers.length === 0) assert.match(text, /No network access/);
  for (const server of servers) assert.ok(text.includes(server), `${server} is listed in:\n${text}`);
}

for (const contract of CONTRACTS) {
  const { bytes, manifest, images } = await packageOf(contract.fixture);
  describe(`the contract of the ${contract.fixture} package`, () => {
    const view = (page: Page) => page.frameLocator(`iframe[title='${manifest.name}']`);
    const widget = (page: Page) => page.frameLocator(`iframe[title='${manifest.name} widget']`);

    /** Installs the package, after checking the Permissions the consent screen lists; the Host then shows its View. */
    async function install(page: Page) {
      await contract.network?.(page);
      await dropFile(page, `${contract.fixture}.zip`, bytes);
      const consent = page.getByRole("dialog", { name: `Install ${manifest.name}?` });
      await assertPermissions(await consent.getByRole("region", { name: `What ${manifest.name} can do` }).innerText(), manifest);
      await consent.getByRole("button", { name: "Accept and install" }).click();
      await contract.started(view(page));
    }

    /** Writes from the View, and waits until the Host has written it, so that a reload cannot cut the write short. */
    async function write(page: Page) {
      await contract.write(view(page), page);
      await until(async () => contract.written(await storageOf(page, manifest.id)), `the Host to write the change of ${manifest.name}`);
    }

    test("installs with its Permissions, its View starts, and what it writes is in the Modules folder and read again after a reload", async () => {
      const page = await host.newPage();
      await install(page);
      await write(page);

      await page.reload();
      await (await showLauncher(page)).getByRole("button", { name: manifest.name, exact: true }).click();
      await contract.readBack(view(page));
    });

    test("its Widget starts, shows what the View wrote, and opens the View", async () => {
      const page = await host.newPage();
      await install(page);
      await write(page);
      await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();

      // The View is loaded behind the Home: it gets the params as an event.
      await contract.widget.shows(widget(page));
      await contract.widget.opensView(widget(page), view(page));
      await shown(page.locator(`iframe[title='${manifest.name}']`));

      // The View is not loaded yet, after a reload on the Home: it gets the params in its handshake.
      await page.reload();
      await contract.widget.shows(widget(page));
      await contract.widget.opensView(widget(page), view(page));
    });

    test("its User guide opens from the Launcher, with its images, next to the Permissions it was granted", async () => {
      const page = await host.newPage();
      await install(page);
      await (await showLauncher(page)).getByRole("listitem").filter({ hasText: manifest.name }).getByRole("button", { name: "About" }).click();
      const about = page.getByRole("dialog", { name: `About ${manifest.name}` });
      await assertPermissions(await about.innerText(), manifest);

      await about.getByRole("button", { name: "User guide" }).click();
      const guide = page.frameLocator(`iframe[title='${manifest.name}: User guide']`);
      await shown(guide.getByRole("heading", { name: manifest.name, level: 1 }));
      assert.equal(await guide.getByRole("img").count(), images);
      for (const image of await guide.getByRole("img").all()) {
        await until(() => loaded(image), `the images of ${manifest.name}'s guide to load`);
      }
    });
  });
}
