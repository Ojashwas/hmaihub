import type { AnyModel } from "@hyperoffice/office-formats";
import type { EditorId } from "@hyperoffice/app-shell/products";

/** Models exercised by the smoke test: editor DOM round-trip and file save/load round-trip. */
export const SMOKE_MODELS: Record<EditorId, AnyModel> = {
  hyperdoc: {
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
      { style: "Heading2", align: "center", runs: [{ text: "Line one\nline two\twith tab" }] }
    ]
  },
  hypersheet: {
    kind: "workbook",
    sheets: [
      { name: "Data", cells: { A1: { v: "Item" }, B1: { v: 10 }, B2: { v: 32 }, B3: { f: "SUM(B1:B2)" } } },
      { name: "Summary", cells: { A1: { f: "Data!B3*2" } } }
    ]
  },
  hyperdeck: {
    kind: "presentation",
    slides: [
      { title: "HyperDeck", bullets: ["First point", "Second & third"] },
      { title: "عنوان", bullets: ["نقطة"], rtl: true }
    ]
  },
  hyperplan: {
    kind: "project",
    name: "Office move",
    start: "2026-11-23",
    tasks: [
      { uid: 1, name: "Plan", durationDays: 2, predecessors: [] },
      { uid: 2, name: "Move", durationDays: 3, predecessors: [1] }
    ]
  }
};

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
