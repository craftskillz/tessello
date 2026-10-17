// The Modules installed in the Host: checking a package, then installing it once the User confirms (CONVENTION.md §8).

import { type Manifest, type PackageFiles, readZip, type ValidationReport } from "@tessello/convention";
import type { Persistence } from "./persistence.ts";

export interface InstalledModule {
  manifest: Manifest;
  /** Every file of the package: path → content. */
  files: PackageFiles;
}

/** What the Host knows about a package before the User decides to install it. */
export type Inspection =
  | { ok: false; report: ValidationReport }
  | {
      ok: true;
      /** No error, but it may carry warnings. */
      report: ValidationReport;
      manifest: Manifest;
      files: PackageFiles;
      /**
       * Installs the Module; a Module with the same ID is replaced and keeps its storage. Until ticket 07, the
       * replacement is not confirmed and added Permissions are not asked again (ADR 0004).
       */
      install(): Promise<InstalledModule>;
    };

export function createRegistry(persistence: Persistence) {
  return {
    inspect(zip: Uint8Array): Inspection {
      const { report, files } = readZip(zip);
      if (!report.valid || !report.manifest || !files) return { ok: false, report };
      const module: InstalledModule = { manifest: report.manifest, files };
      return {
        ok: true,
        report,
        manifest: module.manifest,
        files,
        async install() {
          await persistence.putModule(module);
          return module;
        },
      };
    },
    modules: () => persistence.listModules(),
  };
}
