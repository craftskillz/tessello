import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, readFolder, useHost, zipSample } from "./browser.ts";

const host = useHost();

let watchLater: Uint8Array;
before(async () => {
  watchLater = await zipSample("watch-later");
});

const ID = "dQw4w9WgXcQ";
// 1×1 PNG.
const dot = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const view = (page: Page) => page.frameLocator("iframe[title='Watch Later']");
const field = (page: Page) => view(page).getByRole("textbox", { name: "Paste a YouTube URL" });
const openFromLauncher = (page: Page) => page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Watch Later" }).click();

/**
 * Answers for YouTube, so that the tests do not depend on it: the thumbnails, and oEmbed with `title`, or as when
 * offline while `online.value` is false. `requests` counts the oEmbed requests.
 */
async function fakeYouTube(page: Page, online = { value: true }, title = "Never Gonna Give You Up") {
  const requests = { oembed: 0 };
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/png", body: dot }));
  await page.route("https://www.youtube.com/oembed**", (route) => {
    requests.oembed++;
    if (!online.value) return route.abort("internetdisconnected");
    const url = new URL(route.request().url());
    assert.equal(url.searchParams.get("url"), `https://www.youtube.com/watch?v=${ID}`);
    assert.equal(url.searchParams.get("format"), "json");
    return route.fulfill({
      headers: { "Access-Control-Allow-Origin": "null" },
      contentType: "application/json",
      body: JSON.stringify({ title, author_name: "Rick Astley", type: "video" }),
    });
  });
  return requests;
}

/** Installs the Watch Later Module from its .zip; the Host then shows its View, with no video yet. */
async function install(page: Page) {
  await dropFile(page, "watch-later.zip", watchLater);
  await page.getByRole("dialog", { name: "Install Watch Later?" }).getByRole("button", { name: "Accept and install" }).click();
  await view(page).getByText(/^No videos yet/).waitFor();
}

/** The videos as the Host wrote them, under the key `videos`. A file read while the Host writes it may fail: it is read again. */
async function storedVideos(page: Page): Promise<{ videoId: string; title: string; metaStatus: string }[]> {
  for (let tries = 0; ; tries++) {
    try {
      const file = (await readFolder(page, "modules/.tessello/data/@craftskills/watch-later"))["videos.json"];
      return file ? JSON.parse(file).value : [];
    } catch (error) {
      if (tries === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** Waits until the videos the Host wrote pass `written`, so that a reload cannot cut a write short. */
async function stored(page: Page, written: (videos: Awaited<ReturnType<typeof storedVideos>>) => boolean) {
  for (let tries = 0; tries < 50; tries++) {
    if (written(await storedVideos(page))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not write the change");
}

describe("the Watch Later sample Module", () => {
  test("a pasted URL shows the video with its title and channel, opens it on YouTube at its start, and is kept after a reload", async () => {
    const page = await host.newPage();
    await fakeYouTube(page);
    await install(page);

    // Typed as a User copies it from a message: without https://.
    await field(page).fill(`youtu.be/${ID}?t=1m30s&si=share`);
    await field(page).press("Enter");
    const title = view(page).getByRole("link", { name: "Never Gonna Give You Up", exact: true });
    await title.waitFor();
    await view(page).getByText("Rick Astley").waitFor();
    await view(page).getByText("just now").waitFor();
    assert.equal(await field(page).inputValue(), "", "the field is emptied for the next URL");
    assert.equal(await title.getAttribute("href"), `https://www.youtube.com/watch?v=${ID}&t=90s`);
    assert.equal(await title.getAttribute("target"), "_blank");
    const thumbnail = view(page).getByRole("img", { name: "Thumbnail of Never Gonna Give You Up" });
    assert.equal(await thumbnail.getAttribute("src"), `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
    assert.ok(await thumbnail.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), "the thumbnail is loaded");
    await stored(page, (videos) => videos.some((video) => video.videoId === ID && video.metaStatus === "ok"));

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("link", { name: "Never Gonna Give You Up", exact: true }).waitFor();
    await view(page).getByRole("region", { name: "All" }).getByRole("article").waitFor();
  });

  test("a URL pasted in the field or anywhere on the page is added at once, and the same video is never added twice", async () => {
    const page = await host.newPage();
    await fakeYouTube(page);
    await install(page);
    /** Pastes text on an element of the View, as Ctrl/Cmd+V does. */
    const paste = (selector: string, text: string) =>
      view(page)
        .locator(selector)
        .evaluate((element, text) => {
          const clipboardData = new DataTransfer();
          clipboardData.setData("text/plain", text);
          element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
        }, text);

    await paste("body", `https://www.youtube.com/watch?v=${ID}`);
    await view(page).getByRole("link", { name: "Never Gonna Give You Up", exact: true }).waitFor();
    await paste("body", `youtube.com/shorts/${ID}`);
    await paste("body", "not a video");
    await paste("input", `https://youtu.be/${ID}`);
    assert.equal(await field(page).inputValue(), "");
    await stored(page, (videos) => videos.length === 1 && videos[0].metaStatus === "ok");
    assert.equal(await view(page).getByRole("article").count(), 1);
  });

  test("a video whose title cannot be read is still added, with its URL as title, and Retry reads it", async () => {
    const page = await host.newPage();
    const online = { value: false };
    const requests = await fakeYouTube(page, online);
    await install(page);

    await field(page).fill(`https://www.youtube.com/watch?v=${ID}`);
    await field(page).press("Enter");
    const url = `https://www.youtube.com/watch?v=${ID}`;
    await view(page).getByRole("link", { name: url, exact: true }).waitFor();
    const retry = view(page).getByRole("button", { name: `Read the title of ${url} again` });
    await retry.waitFor();
    await stored(page, (videos) => videos.length === 1 && videos[0].metaStatus === "failed");

    online.value = true;
    await retry.click();
    await view(page).getByRole("link", { name: "Never Gonna Give You Up", exact: true }).waitFor();
    assert.equal(await retry.count(), 0);
    assert.equal(requests.oembed, 2);
    await stored(page, (videos) => videos[0]?.title === "Never Gonna Give You Up");
  });

  test("tells the User when a change cannot be saved, and keeps it on screen", async () => {
    const page = await host.newPage();
    // A value of storage is limited to 1 MB (CONVENTION.md §6.1): a title this long cannot be saved.
    await fakeYouTube(page, { value: true }, "x".repeat(1_100_000));
    await install(page);
    await field(page).fill(`https://www.youtube.com/watch?v=${ID}`);
    await field(page).press("Enter");
    await view(page).getByRole("alert").getByText(/Your last change could not be saved: the storage of the Watch Later Module is full/).waitFor();
    await view(page).getByRole("link", { name: /^x+$/ }).waitFor();
  });
});
