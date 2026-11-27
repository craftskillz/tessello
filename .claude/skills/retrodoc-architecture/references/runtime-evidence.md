# Runtime evidence pass

Read only when the user opts into running the application for a feature, or the selected ticket records that opt-in. Source-based documentation remains the default and is complete without this pass. Applies the documentation contract's root separation, evidence labels and documentary scope; running the application here is a documentary check, not development work on the source.

## Purpose and scope

Run the application to obtain what reading source cannot: `Executed` results for the dossier's `Inferred` and `Unknown` items, a visual record of user-facing states, and an executable acceptance spec for the copy brief. Target only those three outputs. Do not crawl the application, explore unrelated features or re-verify behavior that source and inspected tests already settle unambiguously. The read-only discovery crawl is a separate, last-resort step defined in [surface-first discovery](surface-discovery.md).

Run after the functional page and the source trace, so the feature's pages already list the user journeys, the behavior to preserve, the verification scenarios, the interface inventory and the open questions. Derive every runtime scenario from that list; the run adds evidence to existing claims rather than discovering new scope.

## Isolation and side effects

- Never build, install or run inside `SOURCE_ROOT`. Export the inspected revision to a scratch directory outside both roots (for example `git -C <SOURCE_ROOT> archive <revision> | tar -x -C <scratch>`), or copy the tree without build outputs. Install dependencies and write build products only there. Avoid commands that change the source repository's metadata, such as `git worktree add`.
- Installing dependencies or browsers requires network access; ask before doing it unless the user's opt-in already covers it. Prefer the test runner version the source project already declares.
- Point every storage location the feature writes (data folders, databases, files under a configured documentation path) at a scratch location seeded with synthetic data. Never use real user data or credentials. If a screen requires authentication, ask the user for a test account or skip that screen and record it as not run.
- Neutralize side effects listed in the dossier: version-control commits, outbound email or messages, payments, external API calls, webhooks. Use the application's own configuration switches where they exist. If a side effect cannot be neutralized, do not run the scenarios that trigger it; record them as not run with the reason.
- If the user offers an instance they started, you may use it instead of an isolated copy, but run only scenarios without side effects unless they confirm the instance and its data are disposable.
- Bind to localhost on a free port. Stop every started process and remove the scratch copy at the end, or report its location if the user wants to keep it.

## Token discipline

Drive the browser with a script, not step by step. Write the spec, run it non-interactively, and read only its summary and failures.

- Send install, build and server output to log files in the scratch directory; read only the tail or `grep` for errors.
- Use a terse reporter (for Playwright, `--reporter=line`) and read failure details only for failing tests.
- Write screenshots and network captures (HAR files) to disk. Do not view every screenshot: open at most two to describe the presentation, and `grep` captured traffic instead of reading it whole.
- Allow at most three fix attempts per scenario (selector, timing, setup). After that, stop and record the scenario as `Unknown` with the observed failure.
- Interactive browser control (an MCP browser server or a browser extension that returns page snapshots) is costly per step. Use it only for a screen a script cannot reach, keep it to a few steps, and report that it was used.

## Outputs

Write runtime artifacts under `DOCS_ROOT`, never into the source project:

- `features/<feature-id>/acceptance.spec.<ext>`: an executable acceptance spec, written with the browser test runner (Playwright by default; reuse the source project's runner when it has one). Cover the dossier's behavior to preserve and its verification scenarios, one test per scenario, each naming the dossier scenario it checks. Drive the application through public HTTP endpoints and user-visible roles, labels and text, not framework internals, component names or style classes, so the spec can run against a reimplementation on another stack. Read the base URL from the `BASE_URL` environment variable. Seed and reset state through the public API when one exists.
- `features/<feature-id>/screenshots/<state>-<viewport>-<theme>.png`: one capture per user-facing state in the functional page's interface section (including empty, loading, error and each dialog open), at a desktop width and 375px, in each theme the feature supports. Use synthetic data only.

Run the spec against the original application before linking it. A spec that does not pass against the original is not an acceptance contract: fix it within the attempt limit or remove the failing test and record why. Keep apparent defects out of the spec; check them with separate one-off commands and record the results in the dossier's known-defects list. Keep logs and HAR files in the scratch directory; record only the commands and results in the dossier.

## Recording results

Label each runtime result `Executed`, stating the command, environment (OS, runtime and browser versions), inspected revision and observed outcome. Update the matching `Inferred` or `Unknown` item in place rather than duplicating it. An execution confirms only the exercised cases in that environment; it does not establish behavior under other configurations. A screenshot shows how the feature rendered in that environment, not design intent.

In the dossier's evidence section, list the scenarios run, passed, failed and not run, link the spec and screenshot folder, and give the exact command to re-run the spec against an application at `BASE_URL`. Link screenshots from the functional page's interface section. Then render the page with the bundled HTML renderer so the HTML edition links the same artifacts.
