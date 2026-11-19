import { parseAddress } from "@hyperoffice/office-formats/formula";
import type { AnyModel, ModelKind } from "@hyperoffice/office-formats";

/** Structural validation of models received over IPC before they are serialised. */
export class InvalidModelError extends Error {}

const LIMITS = {
  paragraphs: 200_000,
  runs: 10_000,
  text: 1_000_000,
  sheets: 255,
  cells: 2_000_000,
  formula: 8_192,
  slides: 5_000,
  bullets: 500,
  tasks: 50_000
};

const fail = (msg: string): never => {
  throw new InvalidModelError(msg);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = LIMITS.text): v is string => typeof v === "string" && v.length <= max;
const arr = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
const optBool = (v: unknown) => v === undefined || typeof v === "boolean";

export function validateModel(model: unknown, expected: ModelKind): AnyModel {
  if (!isObj(model) || model["kind"] !== expected) return fail("Model kind does not match this editor");
  switch (expected) {
    case "document": {
      const ps = model["paragraphs"];
      if (!arr(ps, LIMITS.paragraphs)) return fail("Invalid paragraphs");
      for (const p of ps) {
        if (!isObj(p) || !["Normal", "Title", "Heading1", "Heading2"].includes(p["style"] as string))
          fail("Invalid paragraph");
        const para = p as Record<string, unknown>;
        if (para["align"] !== undefined && !["left", "center", "right", "both"].includes(para["align"] as string))
          fail("Invalid alignment");
        if (!optBool(para["rtl"]) || !arr(para["runs"], LIMITS.runs)) fail("Invalid paragraph");
        for (const r of para["runs"] as unknown[]) {
          if (!isObj(r) || !str(r["text"]) || !optBool(r["bold"]) || !optBool(r["italic"]) || !optBool(r["underline"]))
            fail("Invalid run");
        }
      }
      break;
    }
    case "workbook": {
      const sheets = model["sheets"];
      if (!arr(sheets, LIMITS.sheets) || sheets.length === 0) return fail("Invalid sheets");
      let total = 0;
      for (const s of sheets) {
        if (!isObj(s) || !str(s["name"], 31) || !isObj(s["cells"])) return fail("Invalid sheet");
        for (const [key, cell] of Object.entries(s["cells"])) {
          if (++total > LIMITS.cells || !parseAddress(key) || !isObj(cell)) fail("Invalid cell");
          const c = cell as Record<string, unknown>;
          if (c["f"] !== undefined && !str(c["f"], LIMITS.formula)) fail("Invalid formula");
          const v = c["v"];
          if (
            v !== undefined &&
            !(typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) || str(v, 32_767))
          )
            fail("Invalid cell value");
        }
      }
      break;
    }
    case "presentation": {
      const slides = model["slides"];
      if (!arr(slides, LIMITS.slides)) return fail("Invalid slides");
      for (const s of slides) {
        if (!isObj(s) || !str(s["title"], 10_000) || !arr(s["bullets"], LIMITS.bullets) || !optBool(s["rtl"]))
          fail("Invalid slide");
        for (const b of (s as Record<string, unknown>)["bullets"] as unknown[])
          if (!str(b, 10_000)) fail("Invalid bullet");
      }
      break;
    }
    case "project": {
      if (!str(model["name"], 500) || !str(model["start"], 10) || !/^\d{4}-\d{2}-\d{2}$/.test(model["start"] as string))
        fail("Invalid project");
      const tasks = model["tasks"];
      if (!arr(tasks, LIMITS.tasks)) return fail("Invalid tasks");
      const uids = new Set<number>();
      for (const t of tasks) {
        if (!isObj(t) || !Number.isSafeInteger(t["uid"]) || (t["uid"] as number) < 1 || uids.has(t["uid"] as number))
          fail("Invalid task id");
        const task = t as Record<string, unknown>;
        uids.add(task["uid"] as number);
        const d = task["durationDays"];
        if (!str(task["name"], 1000) || typeof d !== "number" || !Number.isFinite(d) || d < 0 || d > 100_000)
          fail("Invalid task");
        if (
          !arr(task["predecessors"], 1000) ||
          !(task["predecessors"] as unknown[]).every((p) => Number.isSafeInteger(p))
        )
          fail("Invalid links");
      }
      break;
    }
  }
  return model as unknown as AnyModel;
}
