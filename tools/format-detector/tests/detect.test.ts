import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import fc from "fast-check";
import {
  DESKTOP_LIMITS,
  detectFormat,
  MINIMAL_MSPDI,
  MINIMAL_PACKAGES,
  PackageSecurityError,
  writeZip,
  type ZipInput
} from "../src/index.ts";

const fixture = (path: string) => readFileSync(new URL(`../../../compatibility/fixtures/${path}`, import.meta.url));
const code = (fn: () => unknown, expected: string) =>
  assert.throws(fn, (e: unknown) => e instanceof PackageSecurityError && e.code === expected);
const docx = MINIMAL_PACKAGES["word/minimal.docx"] as ZipInput[];

describe("format detection on committed fixtures", () => {
  const cases: [string, string][] = [
    ["word/minimal.docx", "docx"],
    ["excel/minimal.xlsx", "xlsx"],
    ["powerpoint/minimal.pptx", "pptx"],
    ["word/macro-preservation.docm", "docm"],
    ["project/minimal-mspdi.xml", "mspdi"]
  ];
  for (const [path, format] of cases) {
    it(`${path} -> ${format}`, () => {
      const result = detectFormat(fixture(path), { fileName: path });
      assert.equal(result.format, format);
      assert.equal(result.level, "L0");
      assert.deepEqual(
        result.warnings.filter((w) => w !== "MACROS_PRESENT"),
        []
      );
    });
  }

  it("flags macros in macro-enabled packages", () => {
    assert.ok(detectFormat(fixture("word/macro-preservation.docm")).warnings.includes("MACROS_PRESENT"));
  });

  it("committed MSPDI fixture matches its source", () => {
    assert.equal(fixture("project/minimal-mspdi.xml").toString("utf8"), MINIMAL_MSPDI);
  });
});

describe("content-based detection", () => {
  it("ignores the file name and reports extension spoofing", () => {
    const bytes = writeZip(docx);
    const r = detectFormat(bytes, { fileName: "invoice.xlsx" });
    assert.equal(r.format, "docx");
    assert.ok(r.warnings.includes("EXTENSION_MISMATCH"));
  });

  it("recognises OLE, PDF, RTF, plain ZIP, and unknown content", () => {
    assert.equal(
      detectFormat(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])).format,
      "ole-compound"
    );
    assert.equal(detectFormat(Buffer.from("%PDF-1.7\n")).format, "pdf");
    assert.equal(detectFormat(Buffer.from("{\\rtf1\\ansi}")).format, "rtf");
    assert.equal(detectFormat(writeZip([{ name: "a.txt", data: "x" }])).format, "zip");
    assert.equal(detectFormat(Buffer.from("hello")).format, "unknown");
    assert.equal(detectFormat(Buffer.from("<!DOCTYPE html><html></html>")).format, "unknown");
  });

  it("requires the MSPDI namespace, not just a <Project> root", () => {
    assert.equal(detectFormat(Buffer.from("<Project><Name>x</Name></Project>")).format, "unknown");
    assert.equal(
      detectFormat(Buffer.from('<p:Project xmlns:p="http://schemas.microsoft.com/project"/>')).format,
      "mspdi"
    );
  });
});

describe("hostile packages", () => {
  it("rejects path traversal and absolute entry names", () => {
    for (const name of ["../evil.xml", "word/../../evil.xml", "/etc/passwd", "C:/evil", "word\\evil.xml"]) {
      code(() => detectFormat(writeZip([...docx, { name, data: "x" }])), "PATH_TRAVERSAL");
    }
  });

  it("rejects duplicate entries, including case-only duplicates", () => {
    code(() => detectFormat(writeZip([...docx, { name: "word/document.xml", data: "x" }])), "DUPLICATE_ENTRY");
    code(() => detectFormat(writeZip([...docx, { name: "WORD/Document.xml", data: "x" }])), "DUPLICATE_ENTRY");
  });

  it("rejects too many entries", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `p${i}.xml`, data: "x" }));
    code(() => detectFormat(writeZip(many), { limits: { ...DESKTOP_LIMITS, maxEntries: 10 } }), "TOO_MANY_ENTRIES");
  });

  it("rejects highly compressed parts before inflating them", () => {
    const bomb = writeZip([
      ...docx,
      { name: "word/media/bomb.bin", data: new Uint8Array(20 * 1024 * 1024), deflate: true }
    ]);
    assert.ok(bomb.length < 200_000);
    code(() => detectFormat(bomb), "ZIP_BOMB_SUSPECTED");
  });

  it("rejects parts whose real inflated size exceeds the declared size", () => {
    const bytes = Buffer.from(writeZip(docx));
    const lying = Buffer.from(bytes);
    // Shrink the declared uncompressed size of [Content_Types].xml in the central directory.
    const cd = lying.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    lying.writeUInt32LE(10, cd + 24);
    code(() => detectFormat(lying), "SIZE_MISMATCH");
    const deflated = Buffer.from(
      writeZip([{ name: "[Content_Types].xml", data: (docx[0] as ZipInput).data, deflate: true }, ...docx.slice(1)])
    );
    const cd2 = deflated.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    deflated.writeUInt32LE(10, cd2 + 24);
    code(() => detectFormat(deflated), "ZIP_BOMB_SUSPECTED");
  });

  it("refuses DTDs inside package XML (XXE / entity expansion)", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE Types [<!ENTITY x SYSTEM "file:///etc/passwd">]><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">&x;</Types>`;
    code(
      () => detectFormat(writeZip([{ name: "[Content_Types].xml", data: xxe }, ...docx.slice(1)])),
      "DTD_NOT_ALLOWED"
    );
  });

  it("does not follow external officeDocument relationships", () => {
    const external = docx.map((e) =>
      e.name === "_rels/.rels"
        ? {
            ...e,
            data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="https://attacker.example/doc.xml" TargetMode="External"/></Relationships>`
          }
        : e
    );
    const r = detectFormat(writeZip(external));
    assert.ok(!r.evidence.some((e) => e.includes("attacker")));
  });

  it("rejects truncated archives", () => {
    const bytes = writeZip(docx);
    code(() => detectFormat(bytes.subarray(0, bytes.length - 30)), "NOT_A_ZIP");
  });

  it("property: arbitrary input never crashes with anything but a PackageSecurityError", () => {
    const prefix = fc.constantFrom(
      Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
      Uint8Array.from([0x50, 0x4b, 0x05, 0x06]),
      Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      new Uint8Array(0)
    );
    fc.assert(
      fc.property(prefix, fc.uint8Array({ maxLength: 512 }), (p, rest) => {
        const input = new Uint8Array([...p, ...rest]);
        try {
          detectFormat(input);
        } catch (err) {
          assert.ok(err instanceof PackageSecurityError, String(err));
        }
      }),
      { numRuns: 2000 }
    );
  });

  it("property: mutated real packages never crash unexpectedly", () => {
    const base = writeZip(docx.map((e) => ({ ...e, deflate: true })));
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat(base.length - 1), fc.integer({ min: 0, max: 255 })), { maxLength: 8 }),
        (edits) => {
          const mutated = Uint8Array.from(base);
          for (const [i, v] of edits) mutated[i] = v;
          try {
            detectFormat(mutated);
          } catch (err) {
            assert.ok(err instanceof PackageSecurityError, String(err));
          }
        }
      ),
      { numRuns: 2000 }
    );
  });
});
