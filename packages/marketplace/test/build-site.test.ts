import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { buildSite } from "../scripts/build-site.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const zip = (id: string, name: string): Uint8Array =>
  zipSync({
    "manifest.json": strToU8(JSON.stringify({ convention: 1, id, name, version: "1.0.0", icon: "icon.svg", view: { entry: "view/index.html" }, guide: "guide.md" })),
    "icon.svg": strToU8("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"),
    "view/index.html": strToU8(READY_VIEW),
    "guide.md": strToU8(`# ${name}\n`),
  });

async function write(path: string, content: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

describe("building the site from a repository folder", () => {
  let dir: string;
  let issues: Awaited<ReturnType<typeof buildSite>>;
  const out = () => join(dir, "out");

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "tessello-site-"));
    const entry = (name: string, bytes: Uint8Array, extra: object = {}) =>
      JSON.stringify({
        id: `@yassine/${name}`,
        source: `https://github.com/yassine/${name}`,
        license: "MIT",
        versions: [{ version: "1.0.0", url: `https://example.org/${name}-1.0.0.zip`, sha256: createHash("sha256").update(bytes).digest("hex") }],
        ...extra,
      });
    const weather = zip("@yassine/weather", "Weather");
    const evil = zip("@yassine/evil", "Evil");
    await write(join(dir, "repo/modules/yassine/weather/entry.json"), entry("weather", weather, { screenshots: ["canvas.png"] }));
    await write(join(dir, "repo/modules/yassine/weather/canvas.png"), PNG);
    await write(join(dir, "repo/modules/yassine/evil/entry.json"), entry("evil", evil, { banned: "Malware" }));
    await write(join(dir, "repo/modules/yassine/broken/entry.json"), "{ not json");
    await write(join(dir, "packages/yassine/weather/1.0.0.zip"), weather);
    await write(join(dir, "packages/yassine/evil/1.0.0.zip"), evil);
    await write(join(out(), "stale.txt"), "left over from an earlier build");
    issues = await buildSite({ repo: join(dir, "repo"), out: out(), hostUrl: "https://tessello.app/", packages: join(dir, "packages"), now: new Date("2026-05-01T08:30:00Z") });
  });
  after(() => rm(dir, { recursive: true, force: true }));

  test("writes index.json, the assets, the pages and the search script, and removes what was there", async () => {
    const index = JSON.parse(await readFile(join(out(), "index.json"), "utf8"));
    assert.equal(index.generatedAt, "2026-05-01T08:30:00.000Z");
    assert.deepEqual(index.modules.map((m: { id: string; state: string }) => [m.id, m.state]), [["@yassine/evil", "banned"], ["@yassine/weather", "listed"]]);
    assert.deepEqual([...(await readFile(join(out(), "modules/yassine/weather/canvas.png")))], [...PNG]);
    assert.match(await readFile(join(out(), "modules/yassine/weather/1.0.0/icon.svg"), "utf8"), /<svg/);
    const list = await readFile(join(out(), "index.html"), "utf8");
    assert.match(list, /data-id="@yassine\/weather"/);
    assert.doesNotMatch(list, /@yassine\/evil/);
    assert.match(await readFile(join(out(), "modules/yassine/evil/index.html"), "utf8"), /Malware/);
    assert.match(await readFile(join(out(), "style.css"), "utf8"), /prefers-color-scheme/);
    assert.match(await readFile(join(out(), "search.js"), "utf8"), /index\.json/);
    assert.ok(!(await readdir(out())).includes("stale.txt"));
  });

  test("reports an unreadable entry.json and skips it", () => {
    assert.deepEqual(issues.map((i) => i.code), ["site/unreadable-entry"]);
    assert.match(issues[0]?.message ?? "", /yassine\/broken/);
  });
});
