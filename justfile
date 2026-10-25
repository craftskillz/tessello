# Tessello: the everyday commands. `just` alone lists them.

default:
    @just --list

# Unit tests of every package (Node, a few seconds)
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

# Builds the npm packages into packages/<name>/dist/, then tests them compiled, and installed from npm pack in a temporary folder
packages:
    npm run test:compiled
    npm run test:packed

# Refreshes the fixture of a @craftskillz Module with its published package, e.g. `just fixture diagram 1.2.0`, then validates it
fixture name version:
    curl -fsSLo packages/host/e2e/fixtures/{{ name }}.zip https://craftskillz.github.io/tessello-{{ name }}/{{ version }}.zip
    node packages/cli/src/cli.ts validate packages/host/e2e/fixtures/{{ name }}.zip

# Publishes the npm packages whose version is not on npm yet, after testing them built and packed (see RELEASING.md)
npm-publish:
    #!/usr/bin/env bash
    set -euo pipefail
    npm run test:compiled --silent
    npm run test:packed --silent
    for name in sdk convention marketplace cli; do
        dist="packages/$name/dist"
        id=$(node -p "require('./$dist/package.json').name")
        version=$(node -p "require('./$dist/package.json').version")
        if [ -n "$(npm view "$id@$version" version 2>/dev/null)" ]; then echo "$id $version is already on npm."; continue; fi
        npm publish --access public "$dist"
        echo "$id $version is published."
    done

# Lists @craftskillz Modules on the Marketplace at their published version: `just marketplace [name...] [--dry-run]`
marketplace *args:
    #!/usr/bin/env bash
    set -uo pipefail
    names=()
    options=()
    for arg in {{ args }}; do
        case "$arg" in
            --*) options+=("$arg") ;;
            *) names+=("$arg") ;;
        esac
    done
    if [ ${#names[@]} -eq 0 ]; then names=(diagram skills-library survival-kit watch-later); fi
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    failed=()
    for name in "${names[@]}"; do
        repo="craftskillz/tessello-$name"
        echo "== @craftskillz/$name"
        if ! version=$(gh api "repos/$repo/contents/manifest.json" -H "Accept: application/vnd.github.raw+json" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version'); then
            echo "Cannot read the Manifest of $repo." >&2; failed+=("$name"); continue
        fi
        url="https://craftskillz.github.io/tessello-$name/$version.zip"
        # The published bytes, not a local build: the listing pins their SHA-256.
        if ! curl -fsSLo "$work/$name.zip" "$url"; then
            echo "$url is not online: run \`just publish minor\` in $repo, then wait for its Release workflow." >&2; failed+=("$name"); continue
        fi
        node packages/cli/src/cli.ts publish "$work/$name.zip" --url "$url" --source "https://github.com/$repo" --accept-terms --out tessello-listing ${options[@]+"${options[@]}"} || failed+=("$name")
    done
    if [ ${#failed[@]} -gt 0 ]; then echo "Not done: ${failed[*]}" >&2; exit 1; fi

# Creates the repository craftskillz/tessello-<name> of a new Module from a template: `just new-module <name> [svelte|typescript]`
new-module name template="svelte":
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{ template }}" in svelte|typescript) ;; *) echo "The template is svelte or typescript." >&2; exit 1 ;; esac
    node -e 'import("./scripts/rename-module.ts").then(({ isModuleName }) => process.exit(isModuleName(process.argv[1]) ? 0 : 1))' "{{ name }}" \
        || { echo '"{{ name }}" is not a Module name: lowercase words joined by dashes, e.g. watch-later.' >&2; exit 1; }
    repo="craftskillz/tessello-{{ name }}"
    dir="../tessello-{{ name }}"
    tessello="$PWD"
    if [ -e "$dir" ]; then echo "$dir already exists." >&2; exit 1; fi
    gh repo create "$repo" --public --template "craftskillz/tessello-template-{{ template }}" --description "A Tessello Module." --homepage https://github.com/craftskillz/tessello
    # GitHub copies the template in the background: wait for its files.
    for _ in $(seq 30); do gh api "repos/$repo/contents/manifest.json" --silent 2>/dev/null && break; sleep 2; done
    git clone --quiet "https://github.com/$repo.git" "$dir"
    cd "$dir"
    node "$tessello/scripts/rename-module.ts" . "{{ name }}"
    npm install --silent
    npm run typecheck --silent
    npm test --silent >/dev/null
    npm run build --silent
    npx tessello validate dist >/dev/null
    git commit --quiet -am "Name the Module {{ name }}"
    git push --quiet
    # GitHub Pages serves the published packages from an empty branch of their own, gh-pages.
    pages=$(mktemp -d)
    git -C "$pages" init --quiet -b gh-pages
    touch "$pages/.nojekyll"
    git -C "$pages" add .nojekyll
    git -C "$pages" commit --quiet -m "Start the GitHub Pages of the published packages"
    git -C "$pages" push --quiet "https://github.com/$repo.git" gh-pages
    rm -rf "$pages"
    gh api -X POST "repos/$repo/pages" -f "source[branch]=gh-pages" -f "source[path]=/" --silent
    echo "$repo is ready in $dir: write the Module, then \`just publish minor\` there."

# Browser tests of the given files only, e.g. `just e2e-only home watch-later`
e2e-only +names: build
    node --test --test-concurrency=1 {{ prepend("packages/host/e2e/", append(".test.ts", names)) }}

# Browser tests in a visible, slowed-down Chromium, e.g. `just e2e-headed home`
e2e-headed +names: build
    HEADED=1 node --test --test-concurrency=1 {{ prepend("packages/host/e2e/", append(".test.ts", names)) }}

# Everything a change must pass: types, unit tests, then browser tests
check: typecheck test e2e
