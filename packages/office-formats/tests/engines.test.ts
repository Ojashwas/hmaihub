import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeWorkbook, evaluateFormula, formatValue, parseFormula } from "../src/formula.ts";
import { addWorkingDays, scheduleProject, ScheduleCycleError } from "../src/schedule.ts";
import type { CellValue } from "../src/models.ts";

const evalIn = (cells: Record<string, CellValue>, f: string) =>
  evaluateFormula(f, { sheet: "S", getCell: (_s, k) => cells[k] ?? null });

describe("formula engine", () => {
  const cells: Record<string, CellValue> = { A1: 10, A2: 20, A3: "x", A4: true, B1: "Hello", B2: 0 };

  const cases: [string, CellValue][] = [
    ["1+2*3", 7],
    ["(1+2)*3", 9],
    ["2^3^2", 64],
    ["-2^2", 4],
    ["10%", 0.1],
    ["A1+A2", 30],
    ["SUM(A1:A4)", 30],
    ["AVERAGE(A1:A2)", 15],
    ["MIN(A1:A2,5)", 5],
    ["MAX(A1:A2)", 20],
    ["COUNT(A1:A4)", 2],
    ["COUNTA(A1:A4)", 4],
    ['IF(A1>5,"big","small")', "big"],
    ["AND(TRUE,A1>5)", true],
    ["OR(FALSE,A1<5)", false],
    ["NOT(A4)", false],
    ["ROUND(2.345,2)", 2.35],
    ["ROUND(-2.5,0)", -3],
    ['CONCAT(B1," ",A1)', "Hello 10"],
    ['B1&"!"', "Hello!"],
    ["LEFT(B1,2)", "He"],
    ["RIGHT(B1,3)", "llo"],
    ["MID(B1,2,3)", "ell"],
    ["LEN(B1)", 5],
    ["UPPER(B1)", "HELLO"],
    ['"a"="A"', true],
    ["A1<>A2", true],
    ["ABS(-3)", 3]
  ];
  for (const [f, expected] of cases) {
    it(`=${f} -> ${String(expected)}`, () => assert.deepEqual(evalIn(cells, f), expected));
  }

  it("propagates errors", () => {
    assert.deepEqual(evalIn(cells, "A1/B2"), { error: "#DIV/0!" });
    assert.deepEqual(evalIn(cells, "A3+1"), { error: "#VALUE!" });
    assert.deepEqual(evalIn(cells, "NOSUCH(1)"), { error: "#NAME?" });
    assert.deepEqual(evalIn(cells, "SUM(1,"), { error: "#NAME?" });
    assert.deepEqual(evalIn(cells, "SUM(A1/B2,1)"), { error: "#DIV/0!" });
  });

  it("parses sheet-qualified references", () => {
    assert.deepEqual(parseFormula("'My Sheet'!A1:B2"), {
      k: "ref",
      sheet: "My Sheet",
      from: { col: 0, row: 0 },
      to: { col: 1, row: 1 }
    });
  });

  it("computes dependency chains, cross-sheet references, and detects cycles", () => {
    const values = computeWorkbook({
      kind: "workbook",
      sheets: [
        {
          name: "One",
          cells: { A1: { v: 2 }, A2: { f: "A1*3" }, A3: { f: "Two!A1+A2" }, B1: { f: "B2" }, B2: { f: "B1" } }
        },
        { name: "Two", cells: { A1: { f: "One!A1*10" } } }
      ]
    });
    assert.equal(values.get("One")?.get("A3"), 26);
    assert.deepEqual(values.get("One")?.get("B1"), { error: "#CYCLE!" });
  });

  it("formats values for display", () => {
    assert.equal(formatValue(0.1 + 0.2), "0.3");
    assert.equal(formatValue(true), "TRUE");
    assert.equal(formatValue(null), "");
  });
});

describe("scheduler", () => {
  it("computes early/late dates, float, and the critical path on working days", () => {
    const r = scheduleProject({
      kind: "project",
      name: "P",
      start: "2026-11-20",
      tasks: [
        { uid: 1, name: "A", durationDays: 2, predecessors: [] },
        { uid: 2, name: "B", durationDays: 3, predecessors: [1] },
        { uid: 3, name: "C", durationDays: 1, predecessors: [1] },
        { uid: 4, name: "D", durationDays: 0, predecessors: [2, 3] }
      ]
    });
    const by = new Map(r.tasks.map((t) => [t.name, t]));
    assert.equal(r.durationDays, 5);
    assert.equal(by.get("A")?.start, "2026-11-20");
    assert.equal(by.get("A")?.finish, "2026-11-23");
    assert.equal(by.get("B")?.start, "2026-11-24");
    assert.equal(by.get("B")?.finish, "2026-11-26");
    assert.equal(by.get("C")?.totalFloat, 2);
    assert.deepEqual(
      r.tasks.filter((t) => t.critical).map((t) => t.name),
      ["A", "B", "D"]
    );
    assert.equal(r.finish, "2026-11-26");
  });

  it("rejects dependency loops and ignores missing predecessors", () => {
    assert.throws(
      () =>
        scheduleProject({
          kind: "project",
          name: "P",
          start: "2026-11-23",
          tasks: [
            { uid: 1, name: "A", durationDays: 1, predecessors: [2] },
            { uid: 2, name: "B", durationDays: 1, predecessors: [1] }
          ]
        }),
      ScheduleCycleError
    );
    const r = scheduleProject({
      kind: "project",
      name: "P",
      start: "2026-11-23",
      tasks: [{ uid: 1, name: "A", durationDays: 1, predecessors: [9] }]
    });
    assert.equal(r.warnings.length, 1);
  });

  it("skips weekends", () => {
    assert.equal(addWorkingDays("2026-11-21", 0), "2026-11-23");
    assert.equal(addWorkingDays("2026-11-27", 1), "2026-11-30");
  });
});
