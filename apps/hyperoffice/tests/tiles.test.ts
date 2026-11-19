import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITORS } from "@hyperoffice/app-shell/products";
import { TILE_GLYPHS } from "../src/tiles.ts";

describe("launcher tiles", () => {
  it("has a tile glyph for every editor", () => {
    for (const id of EDITORS) assert.ok(TILE_GLYPHS[id], id);
  });
});
