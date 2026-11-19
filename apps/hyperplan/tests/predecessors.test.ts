import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePredecessors } from "../src/tasks/predecessors.ts";

describe("predecessor input", () => {
  it("accepts commas, semicolons, and spaces; drops duplicates, invalid ids, and self links", () => {
    assert.deepEqual(parsePredecessors("1, 2;3 3"), [1, 2, 3]);
    assert.deepEqual(parsePredecessors("0, -1, x, 2.5, 4"), [4]);
    assert.deepEqual(parsePredecessors("5, 6", 5), [6]);
    assert.deepEqual(parsePredecessors(""), []);
  });
});
