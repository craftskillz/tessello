import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { sha256 } from "@tessello/marketplace";
import { CORS, githubServer, JANE, URL_1, zipOf } from "./github-server.ts";
import { MARKETPLACE, prepareListing, TERMS, type ListingRequest } from "../src/listing.ts";

const gh = githubServer();
before(() => gh.start());
after(() => gh.stop());
beforeEach(() => gh.reset());

const { marketplace, host } = gh;

function request(zip: Uint8Array, more: Partial<ListingRequest> = {}): ListingRequest {
  return { zip, url: URL_1, marketplace: MARKETPLACE, source: "https://github.com/jane/weather", author: JANE, github: gh.access(), ...more };
}

describe("prepareListing", () => {
  test("a new Module gets an entry and awaits the Approval", async () => {
    const zip = zipOf();
    marketplace();
    host(zip);
    const result = await prepareListing(request(zip));
    assert.ok(result.ok, result.ok ? "" : result.problems.join("\n"));
    const { listing } = result;
    assert.equal(listing.folder, "jane/weather");
    assert.equal(listing.path, "modules/jane/weather/entry.json");
    assert.equal(listing.change, "new-module");
    assert.equal(listing.decision, "approval");
    assert.equal(listing.version, "1.0.0");
    assert.deepEqual(listing.entry, { id: "@jane/weather", source: "https://github.com/jane/weather", license: "MIT", versions: [{ version: "1.0.0", url: URL_1, sha256: await sha256(zip) }] });
    assert.equal(listing.json, `${JSON.stringify(listing.entry, null, 2)}\n`);
  });

  const RAW = `/repos/${MARKETPLACE}/contents/modules/jane/weather/entry.json?ref=main`;
  const FOLDER = `/repos/${MARKETPLACE}/contents/modules/jane/weather?ref=main`;
  const listedEntry = (versions: object[], more: object = {}) => ({ id: "@jane/weather", source: "https://github.com/jane/weather", license: "MIT", tags: ["weather"], versions, ...more });
  const V1 = { version: "1.0.0", url: URL_1, sha256: "a".repeat(64) };
  function alreadyListed(entry: object): void {
    gh.routes[RAW] = { json: entry };
    gh.routes[FOLDER] = { json: [{ type: "file", name: "entry.json", path: "modules/jane/weather/entry.json" }] };
  }
  const problemsOf = (result: Awaited<ReturnType<typeof prepareListing>>) => (result.ok ? assert.fail("expected problems") : result.problems.join("\n"));

  test("a new version is appended to the listing and merges", async () => {
    const zip = zipOf({ version: "1.1.0" });
    marketplace();
    alreadyListed(listedEntry([V1]));
    host(zip, CORS, "/host/weather-1.1.0.zip");
    const result = await prepareListing(request(zip, { url: "https://packages.test/weather-1.1.0.zip", source: undefined }));
    assert.ok(result.ok, result.ok ? "" : result.problems.join("\n"));
    assert.equal(result.listing.change, "new-version");
    assert.equal(result.listing.decision, "merge");
    assert.deepEqual(result.listing.entry, listedEntry([V1, { version: "1.1.0", url: "https://packages.test/weather-1.1.0.zip", sha256: await sha256(zip) }]));
  });

  test("tags replace the previous ones", async () => {
    const zip = zipOf({ version: "1.1.0" });
    marketplace();
    alreadyListed(listedEntry([V1]));
    host(zip, CORS, "/host/weather-1.1.0.zip");
    const result = await prepareListing(request(zip, { url: "https://packages.test/weather-1.1.0.zip", tags: ["forecast"] }));
    assert.ok(result.ok);
    assert.deepEqual(result.listing.entry.tags, ["forecast"]);
  });

  test("an invalid package is reported with the Validator's messages", async () => {
    const result = await prepareListing(request(zipOf({ version: "one" })));
    assert.match(problemsOf(result), /version/i);
    assert.deepEqual(gh.requests, []);
  });

  test("a URL without the CORS header is refused", async () => {
    const zip = zipOf();
    marketplace();
    host(zip, {});
    assert.match(problemsOf(await prepareListing(request(zip))), /Access-Control-Allow-Origin.*GitHub Releases/);
  });

  test("a URL serving other bytes is refused", async () => {
    marketplace();
    host(zipOf({ name: "Other" }));
    assert.match(problemsOf(await prepareListing(request(zipOf()))), /serves other bytes/);
  });

  test("a URL answering 404 is refused", async () => {
    marketplace();
    assert.match(problemsOf(await prepareListing(request(zipOf()))), /weather-1\.0\.0\.zip answered 404/);
  });

  test("an unreachable URL names the URL", async () => {
    marketplace();
    const unreachable: typeof fetch = () => Promise.reject(new Error("connect ECONNREFUSED"));
    const result = await prepareListing(request(zipOf(), { github: { apiUrl: gh.base, fetch: unreachable } }));
    assert.match(problemsOf(result), /Could not download https:\/\/packages\.test\/weather-1\.0\.0\.zip/);
  });

  test("a new Module needs --source", async () => {
    const zip = zipOf();
    marketplace();
    host(zip);
    assert.match(problemsOf(await prepareListing(request(zip, { source: undefined }))), /--source https:\/\/github\.com\/<owner>\/<repo>/);
  });

  test("the license comes from GitHub, or from --license when GitHub reports none", async () => {
    const zip = zipOf();
    marketplace({ "/repos/jane/weather": { json: { private: false, license: { spdx_id: "Apache-2.0" } } } });
    host(zip);
    const result = await prepareListing(request(zip));
    assert.ok(result.ok);
    assert.equal(result.listing.entry.license, "Apache-2.0");

    marketplace({ "/repos/jane/weather": { json: { private: false, license: { spdx_id: "NOASSERTION" } } } });
    host(zip);
    assert.match(problemsOf(await prepareListing(request(zip))), /--license/);
  });

  test("a version already listed is refused, said differently when it is the same package", async () => {
    const zip = zipOf();
    marketplace();
    host(zip);
    alreadyListed(listedEntry([{ ...V1, sha256: await sha256(zip) }]));
    assert.match(problemsOf(await prepareListing(request(zip))), /already listed\./);

    alreadyListed(listedEntry([V1]));
    assert.match(problemsOf(await prepareListing(request(zip))), /a published version cannot change/);
  });

  test("a different source or license for a listed Module is refused", async () => {
    const zip = zipOf({ version: "1.1.0" });
    marketplace();
    alreadyListed(listedEntry([V1]));
    host(zip, CORS, "/host/weather-1.1.0.zip");
    const url = "https://packages.test/weather-1.1.0.zip";
    assert.match(problemsOf(await prepareListing(request(zip, { url, source: "https://github.com/jane/other" }))), /only the Maintainer/);
    assert.match(problemsOf(await prepareListing(request(zip, { url, license: "GPL-3.0" }))), /only the Maintainer/);
  });

  test("an author who does not own the Namespace gets a problem", async () => {
    const zip = zipOf();
    marketplace();
    host(zip);
    assert.match(problemsOf(await prepareListing(request(zip, { author: { login: "mallory", id: 9 } }))), /belongs to the GitHub account "jane"|belongs to the GitHub account.*jane/);
  });

  test("an unknown author is accepted with a note: the CI checks the Namespace", async () => {
    const zip = zipOf();
    marketplace();
    host(zip);
    const result = await prepareListing(request(zip, { author: null }));
    assert.ok(result.ok, result.ok ? "" : result.problems.join("\n"));
    assert.match(result.listing.notes.join("\n"), /Namespace ownership is checked by the CI/);
  });

  test("a Verifier issue is surfaced: the version must be greater", async () => {
    const zip = zipOf({ version: "1.5.0" });
    marketplace();
    alreadyListed(listedEntry([V1, { version: "2.0.0", url: "https://packages.test/weather-2.0.0.zip", sha256: "b".repeat(64) }]));
    host(zip, CORS, "/host/weather-1.5.0.zip");
    assert.match(problemsOf(await prepareListing(request(zip, { url: "https://packages.test/weather-1.5.0.zip" }))), /must be greater/);
  });
});
