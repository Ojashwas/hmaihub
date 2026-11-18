import type { ZipInput } from "./zip-writer.ts";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const OFFICE_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";

const contentTypes = (overrides: [string, string][]) =>
  `${XML}<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides
    .map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`)
    .join("")}</Types>`;

const rootRels = (target: string) =>
  `${XML}<Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="${OFFICE_DOC}" Target="${target}"/></Relationships>`;

/** Minimal detection fixtures. They are not claimed to open in Microsoft Office. */
export const MINIMAL_PACKAGES: Record<string, ZipInput[]> = {
  "word/minimal.docx": [
    {
      name: "[Content_Types].xml",
      data: contentTypes([
        ["/word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"]
      ])
    },
    { name: "_rels/.rels", data: rootRels("word/document.xml") },
    {
      name: "word/document.xml",
      data: `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello HyperDoc</w:t></w:r></w:p><w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t>مرحبا</w:t></w:r></w:p></w:body></w:document>`,
      deflate: true
    }
  ],
  "excel/minimal.xlsx": [
    {
      name: "[Content_Types].xml",
      data: contentTypes([
        ["/xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],
        ["/xl/worksheets/sheet1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"]
      ])
    },
    { name: "_rels/.rels", data: rootRels("xl/workbook.xml") },
    {
      name: "xl/workbook.xml",
      data: `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `${XML}<Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c><c r="B1"><f>A1*2</f><v>2</v></c></row></sheetData></worksheet>`,
      deflate: true
    }
  ],
  "powerpoint/minimal.pptx": [
    {
      name: "[Content_Types].xml",
      data: contentTypes([
        ["/ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"],
        ["/ppt/slides/slide1.xml", "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"]
      ])
    },
    { name: "_rels/.rels", data: rootRels("ppt/presentation.xml") },
    {
      name: "ppt/presentation.xml",
      data: `${XML}<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
    },
    {
      name: "ppt/_rels/presentation.xml.rels",
      data: `${XML}<Relationships xmlns="${RELS_NS}"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
    },
    {
      name: "ppt/slides/slide1.xml",
      data: `${XML}<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sld>`,
      deflate: true
    }
  ],
  "word/macro-preservation.docm": [
    {
      name: "[Content_Types].xml",
      data: contentTypes([
        ["/word/document.xml", "application/vnd.ms-word.document.macroEnabled.main+xml"],
        ["/word/vbaProject.bin", "application/vnd.ms-office.vbaProject"]
      ])
    },
    { name: "_rels/.rels", data: rootRels("word/document.xml") },
    {
      name: "word/document.xml",
      data: `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Macro preservation fixture</w:t></w:r></w:p></w:body></w:document>`
    },
    // Inert placeholder bytes, not a real VBA project; only presence is tested.
    { name: "word/vbaProject.bin", data: new Uint8Array(16) }
  ]
};

export const MINIMAL_MSPDI = `${XML}<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Minimal schedule</Name>
  <StartDate>2026-11-18T08:00:00</StartDate>
  <Tasks>
    <Task><UID>1</UID><ID>1</ID><Name>Design</Name><Duration>PT16H0M0S</Duration></Task>
    <Task><UID>2</UID><ID>2</ID><Name>تنفيذ</Name><Duration>PT8H0M0S</Duration>
      <PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type></PredecessorLink>
    </Task>
  </Tasks>
</Project>
`;
