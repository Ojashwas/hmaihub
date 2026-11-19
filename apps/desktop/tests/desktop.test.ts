import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { InvalidModelError, validateModel } from "../src/main/validate.ts";
import { editorForExtension, EDITORS, isProductId, PRODUCTS } from "../src/shared/products.ts";
import { productIcon } from "../scripts/icons.ts";

describe("IPC model validation", () => {
  it("accepts well-formed models of the expected kind", () => {
    assert.doesNotThrow(() =>
      validateModel(
        { kind: "document", paragraphs: [{ style: "Normal", runs: [{ text: "x", bold: true }] }] },
        "document"
      )
    );
    assert.doesNotThrow(() =>
      validateModel(
        { kind: "workbook", sheets: [{ name: "S", cells: { A1: { v: 1 }, B2: { f: "A1*2" } } }] },
        "workbook"
      )
    );
    assert.doesNotThrow(() =>
      validateModel({ kind: "presentation", slides: [{ title: "t", bullets: ["a"] }] }, "presentation")
    );
    assert.doesNotThrow(() =>
      validateModel(
        {
          kind: "project",
          name: "p",
          start: "2026-11-23",
          tasks: [{ uid: 1, name: "a", durationDays: 1, predecessors: [] }]
        },
        "project"
      )
    );
  });

  it("rejects the wrong kind and malformed content", () => {
    const bad: [unknown, Parameters<typeof validateModel>[1]][] = [
      [{ kind: "workbook", sheets: [] }, "document"],
      [{ kind: "document", paragraphs: [{ style: "Script", runs: [] }] }, "document"],
      [{ kind: "document", paragraphs: [{ style: "Normal", runs: [{ text: 1 }] }] }, "document"],
      [{ kind: "workbook", sheets: [{ name: "S", cells: { A0: { v: 1 } } }] }, "workbook"],
      [{ kind: "workbook", sheets: [{ name: "S", cells: { A1: { v: Infinity } } }] }, "workbook"],
      [{ kind: "workbook", sheets: [] }, "workbook"],
      [{ kind: "presentation", slides: [{ title: "t", bullets: [1] }] }, "presentation"],
      [{ kind: "project", name: "p", start: "tomorrow", tasks: [] }, "project"],
      [
        {
          kind: "project",
          name: "p",
          start: "2026-11-23",
          tasks: [{ uid: 1, name: "a", durationDays: -1, predecessors: [] }]
        },
        "project"
      ],
      [
        {
          kind: "project",
          name: "p",
          start: "2026-11-23",
          tasks: [
            { uid: 1, name: "a", durationDays: 1, predecessors: [] },
            { uid: 1, name: "b", durationDays: 1, predecessors: [] }
          ]
        },
        "project"
      ]
    ];
    for (const [model, kind] of bad)
      assert.throws(() => validateModel(model, kind), InvalidModelError, JSON.stringify(model));
  });
});

describe("product catalogue", () => {
  it("maps extensions to editors and validates ids", () => {
    assert.equal(editorForExtension(".DOCX"), "hyperdoc");
    assert.equal(editorForExtension("xlsx"), "hypersheet");
    assert.equal(editorForExtension("pptx"), "hyperdeck");
    assert.equal(editorForExtension("xml"), "hyperplan");
    assert.equal(editorForExtension("exe"), undefined);
    assert.equal(isProductId("hyperdoc"), true);
    assert.equal(isProductId("__proto__"), false);
    assert.equal(EDITORS.length, 4);
  });

  it("generates a valid 256x256 RGBA PNG icon for every product", () => {
    for (const [id, info] of Object.entries(PRODUCTS)) {
      const png = productIcon(info.id, info.color);
      assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], id);
      assert.equal(png.readUInt32BE(16), 256);
      assert.equal(png.readUInt32BE(20), 256);
      const idatLen = png.readUInt32BE(33);
      assert.equal(inflateSync(png.subarray(41, 41 + idatLen)).length, 256 * (256 * 4 + 1));
    }
  });
});
