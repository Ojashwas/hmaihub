import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cellInputText, parseCellInput } from "../src/cells/cell-input.ts";

describe("formula bar input", () => {
  it("parses formulas, numbers, booleans, text, and clears", () => {
    assert.deepEqual(parseCellInput("=SUM(A1:A3)"), { f: "SUM(A1:A3)" });
    assert.deepEqual(parseCellInput("42.5"), { v: 42.5 });
    assert.deepEqual(parseCellInput("true"), { v: true });
    assert.deepEqual(parseCellInput("hello"), { v: "hello" });
    assert.deepEqual(parseCellInput("="), { v: "=" });
    assert.equal(parseCellInput(""), undefined);
  });

  it("shows the editable text for a cell and round-trips", () => {
    for (const input of ["=A1*2", "7", "TRUE", "Revenue", ""]) {
      assert.equal(cellInputText(parseCellInput(input)), input);
    }
  });
});
