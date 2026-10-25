# Fixtures

The packages (`.zip`) of the four @craftskillz Modules: `diagram`, `skills-library`, `survival-kit` and `watch-later`. Their sources live in `craftskillz/tessello-<name>`, which builds, tests and publishes each package on GitHub Pages. Until a first version is published there, they are built from the `main` branch of these repositories.

The contract tests (`../modules-contract.test.ts`, one entry per Module) prove that each package works in the Host: Permissions, View and Widget, storage in the Modules folder, User guide. The browser tests of the Host (`../<name>.test.ts`) install them through `moduleFixture(name)`, and `packages/cli/test/examples.test.ts` runs the Validator on each one.

To refresh one with a published version, `just fixture <name> <version>` downloads `https://craftskillz.github.io/tessello-<name>/<version>.zip` over the file, then validates it.
