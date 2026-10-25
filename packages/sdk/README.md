# @tessello/sdk

Talks to the Tessello Host from a Module: the context it opens in (surface, language, theme, params), its storage, theme and visibility changes, and opening the View from a Widget. It wraps the message protocol of the [Convention](https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md) and has no dependency.

## Copy it into your Module (recommended)

A Module is a static package: it has no build step to run and no network to reach unless it declares a Permission. So copy the SDK's single file into your package and import it with a relative path:

```sh
npm install @tessello/sdk
cp node_modules/@tessello/sdk/tessello-sdk.js my-module/
```

```js
import { connect } from "../tessello-sdk.js";

const host = await connect();
const notes = (await host.storage.get("notes")) ?? [];
```

## Or bundle it

With a bundler (esbuild, Vite…), import the package itself; its type declarations come with it:

```ts
import { connect, TesselloError } from "@tessello/sdk";
```

A request the Host refuses rejects with a `TesselloError` whose `code` is one of the error codes of the Convention (§5.1), such as `quota_exceeded`.

## Test your Module with the Test Host

`@tessello/sdk/testing` is for your tests only, never for your Module's code. It gives a **Test Host**: your View or Widget connects to it with the usual `connect()`, in a browser, without a Host, a Modules folder or an iframe. It answers with the Host's own protocol and storage, so its errors and size limits are the Host's. It has no sandbox, CSP or Permissions: whether your published package works in the Host is proven by the Host's own tests.

With `node:test` and `playwright`, serve your `dist/`, open your View or Widget, and attach the Test Host before the page loads:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { createTestHost, serveFolder, slowDownCpu, until } from "@tessello/sdk/testing";

test("a note added in the View is saved", async () => {
  const server = await serveFolder("dist");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await slowDownCpu(page); // E2E_CPU_SLOWDOWN=4 runs it as slowly as on a CI machine

  const host = createTestHost({ module: { id: "@me/notes", version: "1.0.0" }, storage: { notes: [] } });
  await host.attach(page, { surface: "view" });
  await page.goto(`${server.url}/view/index.html`);

  await page.getByLabel("New note").fill("Buy milk");
  await page.getByRole("button", { name: "Add note" }).click();
  const notes = await until(() => host.storage.get("notes").then((n) => Array.isArray(n) && n.length > 0 && n));
  assert.deepEqual(notes, [{ text: "Buy milk" }]);

  await browser.close();
  await server.close();
});
```

What a test can do:

- **Context**: `createTestHost({ module, locale, theme, storage })`, `"en-US"` and the light theme by default. `attach(page, { surface: "view", params })` opens a View with `context.params`.
- **Storage**: `host.storage` reads what the Module wrote, and changes it as another surface would. The View and the Widget share it, and it is kept when the page reloads. `host.refuseWrites({ key, code })` makes the Module's writes fail (`quota_exceeded` by default), to test what it tells the User; call the function it returns to stop.
- **Theme and visibility**: `host.setTheme("dark")`, and `setVisible(false)` on what `attach` returns.
- **Navigation**: `host.openedViews` lists the params of each `openView` of the Widget; `host.openView(params)` opens the View with params as its Widget would.
- **Waiting**: `until(read, what)` reads again until `read` gives a value, even after a read that throws, and gives up at a deadline: `setWaitTimeout(ms)` sets it in one place, and `E2E_CPU_SLOWDOWN` multiplies it. `false`, `0` and `""` count as no value yet: to wait for a key whatever its value, wait for `(await host.storage.get(key)) !== null`.
- **The network**: the Test Host does not simulate it. Your page is served without the Host's CSP, so Playwright's `page.route` answers its requests, and counts them.
- **A Widget at its size**: `page.setViewportSize(WIDGET_SIZES.M)`.

For code that runs in Node, `host.mount({ surface })` gives a `transport` to pass to `connect({ transport })`.

A complete suite runs in this repository on the Notes example: [`packages/sdk/e2e/notes.test.ts`](https://github.com/craftskillz/tessello/blob/main/packages/sdk/e2e/notes.test.ts).
