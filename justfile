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

# Browser tests of the given files only, e.g. `just e2e-only home watch-later`
e2e-only +names: build
    node --test --test-concurrency=1 {{ prepend("packages/host/e2e/", append(".test.ts", names)) }}

# Browser tests in a visible, slowed-down Chromium, e.g. `just e2e-headed home`
e2e-headed +names: build
    HEADED=1 node --test --test-concurrency=1 {{ prepend("packages/host/e2e/", append(".test.ts", names)) }}

# Everything a change must pass: types, unit tests, then browser tests
check: typecheck test e2e
