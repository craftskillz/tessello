import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildHost } from "../scripts/build.ts";
import { serveHost } from "../scripts/serve.ts";

describe("the creation skill served by the Host", () => {
  let server: Awaited<ReturnType<typeof serveHost>>["server"];
  let url: string;

  before(async () => {
    await buildHost();
    ({ server, url } = await serveHost(0));
  });
  after(() => server.close());

  test("is plain text a Creator can open in the browser and paste into a conversation, identical to the skill", async () => {
    const response = await fetch(`${url}create-tessello-module.txt`);
    const skill = await readFile(fileURLToPath(new URL("../../../skills/create-tessello-module/SKILL.md", import.meta.url)), "utf8");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), skill);
  });
});
