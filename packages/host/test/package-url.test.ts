import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LIMITS } from "@tessello/convention";
import { checkPackageUrl, downloadPackage } from "../src/package-url.ts";

describe("which URLs the Host downloads a package from", () => {
  test("https: anywhere, and http: on localhost and 127.0.0.1 for Creators", () => {
    for (const url of ["https://example.com/notes.zip", "http://localhost:5000/notes.zip", "http://127.0.0.1:8080/dist/notes.zip"]) {
      assert.deepEqual(checkPackageUrl(url), { status: "accepted", url }, url);
    }
  });

  test("any other scheme, or http: elsewhere, is refused with an explanation", () => {
    for (const url of [
      "http://example.com/notes.zip",
      "http://192.168.1.10/notes.zip",
      "data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==",
      "blob:https://example.com/0d4e",
      "file:///Users/me/notes.zip",
      "ftp://example.com/notes.zip",
    ]) {
      const check = checkPackageUrl(url);
      assert.equal(check.status, "refused", url);
      assert.match(check.status === "refused" ? check.reason : "", /https:/, url);
    }
  });

  test("text that is not a URL is refused", () => {
    const check = checkPackageUrl("notes.zip");
    assert.deepEqual(check, { status: "refused", reason: "This is not a URL. Paste the full address of the .zip file, starting with https://." });
  });

  test("a URL carrying a user name or password is refused, since the browser would not send the request", () => {
    const check = checkPackageUrl("https://me:secret@example.com/notes.zip");
    assert.equal(check.status, "refused");
    assert.match(check.status === "refused" ? check.reason : "", /user name or password/);
  });

  test("spaces around a pasted URL are ignored", () => {
    assert.deepEqual(checkPackageUrl("  https://example.com/notes.zip\n"), { status: "accepted", url: "https://example.com/notes.zip" });
  });
});

/** A body that counts the bytes read from it, and records being cancelled; it sends `chunks` chunks of `size` bytes. */
function countingBody(chunks: number, size: number) {
  const body = { read: 0, cancelled: false, stream: null as unknown as ReadableStream<Uint8Array> };
  let sent = 0;
  body.stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (sent++ === chunks) return controller.close();
        body.read += size;
        controller.enqueue(new Uint8Array(size));
      },
      cancel() {
        body.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return body;
}

const serving = (response: Response) => async () => response;

describe("downloading a package", () => {
  test("a package whose Content-Length is beyond the limit is refused before its body is read", async () => {
    const body = countingBody(1, 16);
    const response = new Response(body.stream, { headers: { "Content-Length": String(LIMITS.packageBytes + 1) } });
    const download = await downloadPackage("https://example.com/big.zip", { fetch: serving(response) });
    assert.equal(download.status, "too-large");
    assert.equal(download.status === "too-large" && download.issue.code, "package/too-large");
    assert.equal(body.read, 0);
    assert.equal(body.cancelled, true);
  });

  test("a package sent without Content-Length is stopped as soon as the bytes received go beyond the limit", async () => {
    const megabyte = 1024 * 1024;
    const body = countingBody(20, megabyte);
    const download = await downloadPackage("https://example.com/big.zip", { fetch: serving(new Response(body.stream)) });
    assert.equal(download.status === "too-large" && download.issue.code, "package/too-large");
    assert.equal(body.read, 11 * megabyte, "stopped at the first chunk beyond 10 MB");
    assert.equal(body.cancelled, true);
  });

  test("a server that answers with an error status is reported with that status", async () => {
    const download = await downloadPackage("https://example.com/gone.zip", { fetch: serving(new Response("Not Found", { status: 404 })) });
    assert.deepEqual(download, { status: "failed", httpStatus: 404 });
  });
});
