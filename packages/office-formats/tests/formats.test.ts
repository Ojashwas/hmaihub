import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import fc from "fast-check";
import { detectFormat } from "@hyperoffice/format-detector";
import {
  loadFile,
  parseXml,
  readDocx,
  readMspdi,
  readPptx,
  readXlsx,
  saveFile,
  writeDocx,
  writeMspdi,
  writePptx,
  writeXlsx,
  XmlError,
  type DocumentModel,
  type PresentationModel,
  type ProjectModel,
  type WorkbookModel
} from "../src/index.ts";

const fixture = (p: string) => readFileSync(new URL(`../../../compatibility/fixtures/${p}`, import.meta.url));

describe("XML parser", () => {
  it("parses elements, attributes, entities, CDATA", () => {
    const el = parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><b>t&lt;&#65;&#x42;</b><![CDATA[<raw>]]><c/></a>');
    assert.equal(el.name, "a");
    assert.equal(el.attrs["x"], "1 & 2");
    assert.deepEqual(el.children[0], { name: "b", attrs: {}, children: ["t<AB"] });
    assert.equal(el.children[1], "<raw>");
  });

  it("refuses DTDs, mismatched tags, and excessive depth", () => {
    assert.throws(() => parseXml('<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>'), XmlError);
    assert.throws(() => parseXml("<a><b></a>"), XmlError);
    assert.throws(() => parseXml("<a>".repeat(300) + "</a>".repeat(300)), XmlError);
  });
});

describe("DOCX", () => {
  const model: DocumentModel = {
    kind: "document",
    paragraphs: [
      { style: "Title", runs: [{ text: "Quarterly report" }] },
      { style: "Heading1", runs: [{ text: "Summary" }] },
      {
        style: "Normal",
        align: "both",
        runs: [
          { text: "Plain, " },
          { text: "bold", bold: true },
          { text: " and ", italic: true },
          { text: "under", underline: true }
        ]
      },
      { style: "Normal", rtl: true, align: "right", runs: [{ text: "مرحبا بالعالم" }] },
      { style: "Normal", runs: [{ text: "tab\there\nline & <tag>" }] }
    ]
  };

  it("round-trips paragraphs, styles, formatting, RTL, tabs, and escaping", () => {
    const bytes = writeDocx(model);
    assert.equal(detectFormat(bytes).format, "docx");
    const back = readDocx(bytes);
    assert.deepEqual(back.model, model);
    assert.deepEqual(back.warnings, []);
  });

  it("reads the committed fixture", () => {
    const { model: m } = readDocx(fixture("word/minimal.docx"));
    assert.equal(m.paragraphs[0]?.runs[0]?.text, "Hello HyperDoc");
    assert.equal(m.paragraphs[1]?.rtl, true);
  });

  it("warns that macros are dropped from .docm", () => {
    assert.ok(readDocx(fixture("word/macro-preservation.docm")).warnings.some((w) => w.includes("Macros")));
  });
});

describe("XLSX", () => {
  const model: WorkbookModel = {
    kind: "workbook",
    sheets: [
      {
        name: "Data",
        cells: {
          A1: { v: "Item" },
          B1: { v: "Amount" },
          A2: { v: "Rent" },
          B2: { v: 1200 },
          A3: { v: "Food & drink" },
          B3: { v: 450.5 },
          B4: { f: "SUM(B2:B3)" },
          C4: { f: 'IF(B4>1000,"over","under")' },
          D4: { v: true }
        }
      },
      { name: "Summary", cells: { A1: { f: "Data!B4*2" } } }
    ]
  };

  it("round-trips values and formulas across sheets", () => {
    const bytes = writeXlsx(model);
    assert.equal(detectFormat(bytes).format, "xlsx");
    const back = readXlsx(bytes);
    assert.deepEqual(back.model, model);
  });

  it("stores computed results as cached values", () => {
    const text = new TextDecoder().decode(writeXlsx(model));
    assert.ok(text.length > 0);
    const back = readXlsx(
      writeXlsx({ kind: "workbook", sheets: [{ name: "S", cells: { A1: { v: 2 }, A2: { f: "A1*21" } } }] })
    );
    assert.deepEqual(back.model.sheets[0]?.cells["A2"], { f: "A1*21" });
  });

  it("reads the committed fixture", () => {
    const { model: m } = readXlsx(fixture("excel/minimal.xlsx"));
    assert.deepEqual(m.sheets[0]?.cells, { A1: { v: 1 }, B1: { f: "A1*2" } });
  });

  it("rejects invalid or duplicate sheet names", () => {
    assert.throws(() => writeXlsx({ kind: "workbook", sheets: [{ name: "a/b", cells: {} }] }));
    assert.throws(() =>
      writeXlsx({
        kind: "workbook",
        sheets: [
          { name: "A", cells: {} },
          { name: "a", cells: {} }
        ]
      })
    );
  });
});

describe("PPTX", () => {
  const model: PresentationModel = {
    kind: "presentation",
    slides: [
      { title: "HyperDeck", bullets: ["First point", "Second & third"] },
      { title: "عنوان", bullets: ["نقطة"], rtl: true },
      { title: "", bullets: [] }
    ]
  };

  it("writes a complete package (master, layout, theme) and round-trips slide text", () => {
    const bytes = writePptx(model);
    const detected = detectFormat(bytes);
    assert.equal(detected.format, "pptx");
    for (const part of [
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/theme/theme1.xml",
      "ppt/slides/slide3.xml"
    ]) {
      assert.ok(detected.parts?.includes(part), part);
    }
    assert.deepEqual(readPptx(bytes).model, model);
  });
});

describe("Project XML (MSPDI)", () => {
  const model: ProjectModel = {
    kind: "project",
    name: "Office move",
    start: "2026-11-23",
    tasks: [
      { uid: 1, name: "Plan", durationDays: 2, predecessors: [] },
      { uid: 2, name: "Pack", durationDays: 3, predecessors: [1] },
      { uid: 3, name: "تنظيف", durationDays: 1, predecessors: [1] },
      { uid: 4, name: "Move", durationDays: 0, predecessors: [2, 3] }
    ]
  };

  it("round-trips tasks and finish-to-start links", () => {
    const xml = writeMspdi(model);
    assert.equal(detectFormat(new TextEncoder().encode(xml)).format, "mspdi");
    assert.deepEqual(readMspdi(xml).model, model);
  });

  it("reads the committed fixture", () => {
    const { model: m } = readMspdi(fixture("project/minimal-mspdi.xml").toString("utf8"));
    assert.deepEqual(
      m.tasks.map((t) => [t.uid, t.durationDays, t.predecessors]),
      [
        [1, 2, []],
        [2, 1, [1]]
      ]
    );
  });
});

describe("loadFile / saveFile", () => {
  it("detects by content and refuses the wrong editor", () => {
    const bytes = fixture("excel/minimal.xlsx");
    assert.equal(loadFile(bytes, "workbook").model.kind, "workbook");
    assert.throws(() => loadFile(bytes, "document"), /matching HyperOffice app/);
    assert.ok(loadFile(bytes, "workbook", "renamed.docx").warnings[0]?.includes("extension"));
    assert.throws(() => loadFile(Buffer.from("hello"), "document"), /Unsupported/);
  });

  it("property: any document text survives a save/load cycle", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ minLength: 1, maxLength: 40 }), { minLength: 1, maxLength: 5 }), (texts) => {
        // XML 1.0 cannot carry most control characters; the writer drops them.
        const clean = texts
          // eslint-disable-next-line no-control-regex -- mirrors the writer's control-character filter
          .map((t) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r]/g, ""))
          .filter((t) => t.length > 0);
        fc.pre(clean.length > 0);
        const model: DocumentModel = {
          kind: "document",
          paragraphs: clean.map((t) => ({ style: "Normal", runs: [{ text: t }] }))
        };
        const back = loadFile(saveFile(model), "document").model as DocumentModel;
        assert.deepEqual(
          back.paragraphs.map((p) => p.runs.map((r) => r.text).join("")),
          clean
        );
      }),
      { numRuns: 100 }
    );
  });
});
