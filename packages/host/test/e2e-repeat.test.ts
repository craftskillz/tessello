import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type FileRun, summarize, type TestEvent } from "../scripts/e2e-repeat.ts";

/** A run of one file that passed every test. */
const passing = (file: string, durationMs: number): FileRun => ({ file, durationMs, events: [] });

describe("the summary of repeated browser test runs", () => {
  test("gives the median and the longest duration of each file", () => {
    const summary = summarize([
      passing("home.test.ts", 3000),
      passing("diagram.test.ts", 60000),
      passing("home.test.ts", 1000),
      passing("diagram.test.ts", 90000),
      passing("home.test.ts", 2000),
      passing("diagram.test.ts", 70000),
      passing("diagram.test.ts", 80000),
    ]);
    assert.deepEqual(summary.files, [
      { file: "diagram.test.ts", runs: 4, medianMs: 75000, maxMs: 90000 },
      { file: "home.test.ts", runs: 3, medianMs: 2000, maxMs: 3000 },
    ]);
  });

  test("lists each test that failed, by its full name, with how many runs it failed in and its first message on one line", () => {
    const flakyRun = (message: string): FileRun => ({
      file: "diagram.test.ts",
      durationMs: 1,
      events: [
        { type: "test:start", data: { name: "Diagram", nesting: 0 } },
        { type: "test:start", data: { name: "saves", nesting: 1 } },
        { type: "test:pass", data: { name: "saves", nesting: 1 } },
        { type: "test:start", data: { name: "links", nesting: 1 } },
        { type: "test:start", data: { name: "writes the change", nesting: 2 } },
        failure("writes the change", 2, "testCodeFailure", message),
        failure("links", 1, "subtestsFailed", "1 subtest failed"),
        failure("Diagram", 0, "subtestsFailed", "1 subtest failed"),
      ],
    });
    const summary = summarize([
      flakyRun("the Host did not write the change\n\nfalse !== true\n"),
      passing("diagram.test.ts", 1),
      flakyRun("a later message"),
    ]);
    assert.deepEqual(summary.failures, [
      { file: "diagram.test.ts", test: "Diagram › links › writes the change", failed: 2, runs: 3, firstMessage: "the Host did not write the change false !== true" },
    ]);
  });

  test("blames a failed hook on its suite, not on each test it stopped", () => {
    const summary = summarize([
      {
        file: "home.test.ts",
        durationMs: 1,
        events: [
          { type: "test:start", data: { name: "Home", nesting: 0 } },
          { type: "test:start", data: { name: "shows the Widgets", nesting: 1 } },
          failure("shows the Widgets", 1, "cancelledByParent", "test did not finish before its parent and was cancelled"),
          failure("Home", 0, "hookFailed", "browserType.launch: Executable doesn't exist"),
        ],
      },
    ]);
    assert.deepEqual(summary.failures, [
      { file: "home.test.ts", test: "Home", failed: 1, runs: 1, firstMessage: "browserType.launch: Executable doesn't exist" },
    ]);
  });
});

/** The `test:fail` event of a test, its error wrapping the one it threw as `node:test` does. */
function failure(name: string, nesting: number, failureType: string, message: string): TestEvent {
  return { type: "test:fail", data: { name, nesting, details: { error: { failureType, message: "test failed", cause: new Error(message) } } } };
}
