# Tessello: the everyday commands. `just` alone lists them.

default:
    @just --list

# Unit tests of every package and sample Module (Node, a few seconds)
test:
    npm test

# Type checking of the whole repository
typecheck:
    npm run typecheck

# Builds the Host into packages/host/dist
build:
    npm run build:host

# Builds the Host and serves it locally
start:
    npm run start:host

# Every browser test, one file after the other (Playwright + Chromium, several minutes)
e2e:
    npm run test:browser

# Builds sample Modules into dist/, zips each into sample-modules/<name>/<name>.zip and validates it. Add `major`, `minor` or
# `patch` (or `fix`) anywhere to raise the version first, e.g. `just module skills-library diagram` or `just module skills-library minor`
module +args:
    #!/usr/bin/env bash
    set -euo pipefail
    bump=""
    names=()
    for arg in {{ args }}; do
        case "$arg" in
            major|minor|patch) bump="$arg" ;;
            fix) bump="patch" ;;
            *) names+=("$arg") ;;
        esac
    done
    if [ ${#names[@]} -eq 0 ]; then echo "Name at least one Module of sample-modules/." >&2; exit 1; fi
    for name in "${names[@]}"; do
        dir="sample-modules/$name"
        if [ ! -f "$dir/manifest.json" ]; then echo "No Module at $dir." >&2; exit 1; fi
        if [ -n "$bump" ]; then
            # package.json and package-lock.json through npm, then the Manifest, so that all three keep the same version.
            npm version "$bump" -w "$dir" --no-git-tag-version --silent >/dev/null
            # Only the value of "version" is replaced, so that the rest of the Manifest keeps its layout.
            node -e 'const fs = require("fs"); const [dir] = process.argv.slice(1); const { version } = JSON.parse(fs.readFileSync(`${dir}/package.json`, "utf8")); const path = `${dir}/manifest.json`; fs.writeFileSync(path, fs.readFileSync(path, "utf8").replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`));' "$dir"
            echo "$name is now at $(node -p "require('./$dir/manifest.json').version")"
        fi
        (cd "$dir" && npm run build --silent)
        # zip -r adds to an existing archive, so a file removed from dist/ would stay in an old one.
        rm -f "$dir/$name.zip"
        (cd "$dir/dist" && zip -qr "../$name.zip" .)
        node packages/cli/src/cli.ts validate "$dir/dist"
    done

# Browser tests of the given files only, e.g. `just e2e-only home watch-later`
e2e-only +names: build
    node --test --test-concurrency=1 {{ prepend("packages/host/e2e/", append(".test.ts", names)) }}

# Browser tests in a visible, slowed-down Chromium, e.g. `just e2e-headed home`
e2e-headed +names: build
    HEADED=1 node --test --test-concurrency=1 {{ prepend("packages/host/e2e/", append(".test.ts", names)) }}

# Everything a change must pass: types, unit tests, then browser tests
check: typecheck test e2e
