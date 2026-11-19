import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FILE_EXTENSIONS } from "@hyperoffice/office-formats";
import { EDITORS, PRODUCTS } from "../src/products.ts";

describe("product catalogue", () => {
  it("every editor opens and saves exactly what the format engine supports", () => {
    for (const id of EDITORS) {
      const p = PRODUCTS[id];
      assert.ok(p.kind, id);
      const formats = FILE_EXTENSIONS[p.kind];
      assert.equal(p.saveExtension, formats.save, id);
      for (const ext of p.openExtensions) assert.ok(formats.open.includes(ext), `${id} opens .${ext}`);
    }
  });

  it("has unique names and application ids", () => {
    const all = Object.values(PRODUCTS);
    assert.equal(new Set(all.map((p) => p.name)).size, all.length);
    assert.equal(new Set(all.map((p) => p.appId)).size, all.length);
  });
});
