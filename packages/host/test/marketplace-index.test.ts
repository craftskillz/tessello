import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assetUrl, createHttpIndexSource } from "../src/marketplace-index.ts";

const INDEX_URL = "https://marketplace.example/index.json";
const INDEX = { format: 1, generatedAt: "2026-05-01T08:30:00.000Z", modules: [] };

/** A fake fetch answering with this body and status, and recording the URLs asked for. */
function fakeFetch(body: unknown, status = 200) {
  const asked: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    asked.push(String(url));
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof globalThis.fetch;
  return { fetch, asked };
}

describe("the Marketplace index downloaded by the browser", () => {
  test("index.json is fetched from the index address and returned", async () => {
    const { fetch, asked } = fakeFetch(INDEX);
    assert.deepEqual(await createHttpIndexSource(INDEX_URL, fetch).fetch(), INDEX);
    assert.deepEqual(asked, [INDEX_URL]);
  });

  test("an answer that is not an index is rejected", async () => {
    for (const body of ["<html>Not found</html>", { format: 2, modules: [] }, { format: 1 }, { format: 1, modules: {} }, [], "null"]) {
      await assert.rejects(createHttpIndexSource(INDEX_URL, fakeFetch(body).fetch).fetch(), Error, JSON.stringify(body));
    }
  });

  test("an error status, or a network failure, is rejected", async () => {
    await assert.rejects(createHttpIndexSource(INDEX_URL, fakeFetch(INDEX, 503).fetch).fetch());
    const failing = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof globalThis.fetch;
    await assert.rejects(createHttpIndexSource(INDEX_URL, failing).fetch());
  });

  test("an asset path is relative to index.json", () => {
    assert.equal(assetUrl(INDEX_URL, "modules/craftskillz/notes/1.1.0/icon.svg"), "https://marketplace.example/modules/craftskillz/notes/1.1.0/icon.svg");
    assert.equal(
      assetUrl("http://127.0.0.1:5000/site/index.json", "modules/a/b/shot.png"),
      "http://127.0.0.1:5000/site/modules/a/b/shot.png",
    );
  });
});
