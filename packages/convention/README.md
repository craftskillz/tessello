# @tessello/convention

The limits of the Tessello [Convention](https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md) and the Validator that checks a Module package against them. Isomorphic: it runs in Node and in the browser, and never touches the network. The `tessello` CLI and the Host both use it.

```ts
import { validateZip } from "@tessello/convention";

const report = validateZip(new Uint8Array(zipBytes));
if (!report.valid) for (const issue of report.issues) console.log(issue.severity, issue.message);
```

`validatePackage(files)` does the same from a `Map` of paths to bytes. A Module is installable when the report has no error.

To check a Module from a terminal, use the CLI: `npx tessello validate <folder or .zip>`.
