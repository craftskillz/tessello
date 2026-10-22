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
    assert.match(url.searchParams.get("url") ?? "", /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
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
async function storedVideos(page: Page): Promise<{ videoId: string; title: string; metaStatus: string; watched: boolean; note?: string; tags: string[] }[]> {
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

/** The settings as the Host wrote them, under the key `settings`; null when none was written. */
async function storedSettings(page: Page): Promise<{ hideWatched: boolean } | null> {
  const file = (await readFolder(page, "modules/.tessello/data/@craftskills/watch-later"))["settings.json"];
  return file ? JSON.parse(file).value : null;
}

/** Adds a video by its URL, typed in the field, and waits for its title. */
async function addByField(page: Page, url: string, title = "Never Gonna Give You Up") {
  await field(page).fill(url);
  await field(page).press("Enter");
  await view(page).getByRole("link", { name: title, exact: true }).first().waitFor();
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
    await view(page).getByRole("region", { name: "No tag" }).getByRole("article").waitFor();
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
    await paste("form input", `https://youtu.be/${ID}`);
    assert.equal(await field(page).inputValue(), "");
    await stored(page, (videos) => videos.length === 1 && videos[0].metaStatus === "ok");
    assert.equal(await view(page).getByRole("article").count(), 1);
  });

  test("a dropped link adds the video, a second drop of it adds nothing and shows it, and what is not a video is refused", async () => {
    const page = await host.newPage();
    await fakeYouTube(page);
    await install(page);
    /** Drags data over the View and, unless `release` is false, drops it, as dragging a link from a tab does. */
    const drop = (data: Record<string, string>, release = true) =>
      view(page)
        .locator("body")
        .evaluate(
          (body, { data, release }) => {
            const dataTransfer = new DataTransfer();
            for (const [type, value] of Object.entries(data)) dataTransfer.setData(type, value);
            const fire = (type: string) => body.dispatchEvent(new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true }));
            fire("dragenter");
            fire("dragover");
            if (release) fire("drop");
          },
          { data, release },
        );

    await drop({ "text/uri-list": `https://www.youtube.com/watch?v=${ID}` }, false);
    const zone = view(page).getByText("Drop to add");
    await zone.waitFor();
    // Escape, or leaving the View, ends the drag.
    await view(page)
      .locator("body")
      .evaluate((body) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/uri-list", "https://example.com");
        body.dispatchEvent(new DragEvent("dragleave", { dataTransfer, bubbles: true }));
      });
    await zone.waitFor({ state: "hidden" });

    await drop({ "text/uri-list": `# Never Gonna Give You Up\nhttps://www.youtube.com/watch?v=${ID}`, "text/plain": "Never Gonna Give You Up" });
    await view(page).getByRole("link", { name: "Never Gonna Give You Up", exact: true }).waitFor();
    assert.equal(await zone.count(), 0, "the drop zone is gone once dropped");
    await stored(page, (videos) => videos.length === 1 && videos[0].metaStatus === "ok");

    // Another form of the same video, at another start.
    await drop({ "text/plain": `https://youtu.be/${ID}?t=42` });
    await view(page).getByRole("status").getByText("This video is already in your list").waitFor();
    assert.equal(await view(page).getByRole("article").count(), 1);

    await drop({ "text/plain": "https://example.com/not-a-video" });
    await view(page).getByRole("status").getByText("This is not a YouTube video").waitFor();

    await drop({ "text/plain": `youtu.be/${ID}\nhttps://youtu.be/aaaaaaaaaaa\nnot a video` });
    await view(page).getByRole("status").getByText("1 added, 1 already there, 1 ignored").waitFor();
    await stored(page, (videos) => videos.length === 2);
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

  test("a video marked as watched is hidden, shown again when the watched are not hidden, and its note survives a reload", async () => {
    const page = await host.newPage();
    await fakeYouTube(page);
    await install(page);
    await addByField(page, `https://www.youtube.com/watch?v=${ID}`);
    await stored(page, (videos) => videos[0]?.metaStatus === "ok");
    const card = view(page).getByRole("article", { name: "Never Gonna Give You Up" });
    const hideWatched = view(page).getByRole("checkbox", { name: "Hide watched" });
    assert.equal(await hideWatched.isChecked(), true, "the watched videos are hidden by default");

    await card.getByRole("button", { name: "Watched" }).click();
    await card.waitFor({ state: "detached" });
    const notice = view(page).getByRole("status");
    await notice.getByText("Marked as watched").waitFor();
    await stored(page, (videos) => videos[0]?.watched === true);

    // Undo brings it back as to watch.
    await notice.getByRole("button", { name: "Undo" }).click();
    await card.waitFor();
    await stored(page, (videos) => videos[0]?.watched === false);
    await card.getByRole("button", { name: "Watched" }).click();
    await card.waitFor({ state: "detached" });

    await hideWatched.uncheck();
    await card.waitFor();
    assert.equal(await card.getByRole("button", { name: "Watched" }).getAttribute("aria-pressed"), "true");
    await card.getByText("Watched", { exact: true }).first().waitFor();

    await card.getByRole("button", { name: "Details" }).click();
    const details = view(page).getByRole("dialog", { name: "Never Gonna Give You Up" });
    await details.getByText("Rick Astley").waitFor();
    const note = details.getByRole("textbox", { name: "Note" });
    assert.equal(await note.getAttribute("maxlength"), "2000");
    await note.fill("For the talk on Friday");
    // Saved when the field is left.
    await note.blur();
    await stored(page, (videos) => videos[0]?.note === "For the talk on Friday");
    await details.getByRole("button", { name: "Close" }).click();
    await details.waitFor({ state: "detached" });
    await card.getByRole("img", { name: "Has a note" }).waitFor();
    await stored(page, () => true);
    for (let tries = 0; (await storedSettings(page))?.hideWatched !== false; tries++) {
      assert.ok(tries < 50, "the Host did not write the settings");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await page.reload();
    await openFromLauncher(page);
    assert.equal(await view(page).getByRole("checkbox", { name: "Hide watched" }).isChecked(), false, "the choice is kept");
    await card.getByRole("button", { name: "Details" }).click();
    assert.equal(await details.getByRole("textbox", { name: "Note" }).inputValue(), "For the talk on Friday");
  });

  test("a video is deleted only once the User confirms it", async () => {
    const page = await host.newPage();
    await fakeYouTube(page);
    await install(page);
    await addByField(page, `https://www.youtube.com/watch?v=${ID}`);
    const card = view(page).getByRole("article", { name: "Never Gonna Give You Up" });
    const details = view(page).getByRole("dialog", { name: "Never Gonna Give You Up" });
    const confirmation = view(page).getByRole("dialog", { name: "Delete this video?" });

    await card.getByRole("button", { name: "Details" }).click();
    await details.getByRole("button", { name: "Delete" }).click();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await confirmation.waitFor({ state: "detached" });
    await card.waitFor();

    await details.getByRole("button", { name: "Delete" }).click();
    await confirmation.getByRole("button", { name: "Delete" }).click();
    await card.waitFor({ state: "detached" });
    await details.waitFor({ state: "detached" });
    await view(page).getByText(/^No videos yet/).waitFor();
    await stored(page, (videos) => videos.length === 0);
  });

  test("two tags give two rows, a video with both is in each, and the videos without a tag are in the last row", async () => {
    const page = await host.newPage();
    await fakeYouTube(page);
    await install(page);
    const OTHER = "aaaaaaaaaaa";
    const row = (name: string) => view(page).getByRole("region", { name, exact: true });
    const details = view(page).getByRole("dialog");

    await addByField(page, `https://www.youtube.com/watch?v=${ID}`);
    await row("No tag").getByRole("article").waitFor();

    await view(page).getByRole("article").getByRole("button", { name: "Details" }).click();
    const tag = details.getByRole("combobox", { name: "Add a tag" });
    await tag.fill("  Music ");
    await tag.press("Enter");
    await tag.fill("80s");
    await tag.press("Enter");
    await details.getByRole("button", { name: "Remove the tag Music" }).waitFor();
    await details.getByRole("button", { name: "Close" }).click();
    await row("80s").getByRole("article").waitFor();
    await row("Music").getByRole("article").waitFor();
    assert.equal(await row("No tag").count(), 0, "an empty row is not shown");
    assert.deepEqual(await view(page).getByRole("region").evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label"))), ["80s", "Music"]);

    // A tag chosen beside the field is put on the next videos added, as it was first written.
    const forNew = view(page).getByRole("combobox", { name: "Tags for new videos" });
    await forNew.fill("music");
    await forNew.press("Enter");
    await field(page).fill(`https://youtu.be/${OTHER}`);
    await field(page).press("Enter");
    await row("Music").locator(`[data-video-id="${OTHER}"]`).waitFor();
    assert.equal(await row("Music").getByRole("article").count(), 2);
    await row("Music").getByText("2 videos", { exact: true }).waitFor();
    await stored(page, (videos) => videos.find((video) => video.videoId === OTHER)?.tags.join() === "Music");

    await row("80s").getByRole("button", { name: "Details" }).click();
    await details.getByRole("button", { name: "Remove the tag 80s" }).click();
    await details.getByRole("button", { name: "Remove the tag Music" }).click();
    await details.getByRole("button", { name: "Close" }).click();
    await row("No tag").locator(`[data-video-id="${ID}"]`).waitFor();
    assert.equal(await row("80s").count(), 0);
    await stored(page, (videos) => videos.find((video) => video.videoId === ID)?.tags.length === 0);
  });
});
