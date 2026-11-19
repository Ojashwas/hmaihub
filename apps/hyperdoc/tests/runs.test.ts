import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TextRun } from "@hyperoffice/office-formats/models";
import { pushRun } from "../src/document/runs.ts";

describe("run building", () => {
  it("merges adjacent text with identical formatting", () => {
    const runs: TextRun[] = [];
    pushRun(runs, "Hello", {});
    pushRun(runs, " world", {});
    pushRun(runs, "!", { bold: true });
    pushRun(runs, "!", { bold: true });
    pushRun(runs, "", { italic: true });
    assert.deepEqual(runs, [{ text: "Hello world" }, { text: "!!", bold: true }]);
  });

  it("keeps different formatting separate", () => {
    const runs: TextRun[] = [];
    pushRun(runs, "a", { bold: true });
    pushRun(runs, "b", { bold: true, italic: true });
    pushRun(runs, "c", { underline: true });
    assert.deepEqual(runs, [
      { text: "a", bold: true },
      { text: "b", bold: true, italic: true },
      { text: "c", underline: true }
    ]);
  });
});
