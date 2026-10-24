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
