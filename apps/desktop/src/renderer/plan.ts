import type { PlanTask, ProjectModel } from "@hyperoffice/office-formats/models";
import {
  addWorkingDays,
  nextWorkingDay,
  scheduleProject,
  type ScheduleResult
} from "@hyperoffice/office-formats/schedule";
import { button, el, separator, wireDocumentCommands, type Shell } from "./shell.ts";

const DAY_PX = 26;

const today = () => nextWorkingDay(new Date().toISOString().slice(0, 10));

export function mountPlan(shell: Shell): void {
  let model: ProjectModel = newModel();
  let result: ScheduleResult | null = null;

  const nameInput = el("input", { class: "plan-name", "aria-label": "Project name" });
  const startInput = el("input", { type: "date", "aria-label": "Project start date" });
  const table = el("table", { class: "task-table" });
  const gantt = el("div", { class: "gantt", "aria-label": "Gantt chart", role: "img" });
  shell.content.append(
    el("div", { class: "plan-header" }, el("label", {}, "Project ", nameInput), el("label", {}, "Start ", startInput)),
    el("div", { class: "plan-body" }, el("div", { class: "task-pane" }, table), gantt)
  );
  const summary = el("span");
  shell.status.append(summary);

  function newModel(): ProjectModel {
    return {
      kind: "project",
      name: "New project",
      start: today(),
      tasks: [{ uid: 1, name: "First task", durationDays: 1, predecessors: [] }]
    };
  }

  const { markDirty } = wireDocumentCommands<ProjectModel>(shell, {
    newModel,
    getModel: () => model,
    setModel: (m) => {
      model = m;
      renderAll();
    }
  });

  shell.toolbar.append(
    button("+ Task", "Add task", () => {
      const uid = Math.max(0, ...model.tasks.map((t) => t.uid)) + 1;
      const prev = model.tasks[model.tasks.length - 1];
      model.tasks.push({ uid, name: `Task ${uid}`, durationDays: 1, predecessors: prev ? [prev.uid] : [] });
      markDirty();
      renderAll();
    }),
    separator(),
    el(
      "span",
      { class: "legend" },
      el("i", { class: "swatch critical" }),
      "Critical path ",
      el("i", { class: "swatch" }),
      "Has slack"
    )
  );

  nameInput.addEventListener("input", () => {
    model.name = nameInput.value;
    markDirty();
  });
  startInput.addEventListener("change", () => {
    if (!startInput.value) return;
    model.start = nextWorkingDay(startInput.value);
    markDirty();
    renderAll();
  });

  function parsePreds(text: string): number[] {
    return [
      ...new Set(
        text
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      )
    ];
  }

  function cellInput(task: PlanTask, field: "name" | "durationDays" | "predecessors"): HTMLInputElement {
    const value = field === "predecessors" ? task.predecessors.join(", ") : String(task[field]);
    const input = el("input", {
      value,
      "aria-label": `${field} of task ${task.uid}`,
      ...(field === "durationDays" ? { type: "number", min: 0, step: 1 } : {})
    });
    input.addEventListener("change", () => {
      if (field === "name") task.name = input.value;
      else if (field === "durationDays") task.durationDays = Math.max(0, Math.round(Number(input.value) || 0));
      else task.predecessors = parsePreds(input.value).filter((p) => p !== task.uid);
      markDirty();
      renderAll();
    });
    return input;
  }

  function renderTable() {
    const scheduled = new Map(result?.tasks.map((t) => [t.uid, t]));
    const head = el(
      "tr",
      {},
      ...["ID", "Task", "Days", "Predecessors", "Start", "Finish", "Slack", ""].map((h) =>
        el("th", { text: h, scope: "col" })
      )
    );
    const rows = model.tasks.map((t) => {
      const s = scheduled.get(t.uid);
      const del = button("✕", `Delete task ${t.uid}`, () => {
        model.tasks = model.tasks.filter((x) => x !== t);
        for (const x of model.tasks) x.predecessors = x.predecessors.filter((p) => p !== t.uid);
        markDirty();
        renderAll();
      });
      return el(
        "tr",
        { class: s?.critical ? "critical" : "" },
        el("td", { text: String(t.uid) }),
        el("td", {}, cellInput(t, "name")),
        el("td", { class: "narrow" }, cellInput(t, "durationDays")),
        el("td", {}, cellInput(t, "predecessors")),
        el("td", { text: s?.start ?? "" }),
        el("td", { text: s?.finish ?? "" }),
        el("td", { text: s ? `${s.totalFloat}d` : "" }),
        el("td", {}, del)
      );
    });
    table.replaceChildren(el("thead", {}, head), el("tbody", {}, ...rows));
  }

  function renderGantt() {
    if (!result) return;
    const days = Math.max(result.durationDays, 1) + 5;
    const header = el("div", { class: "gantt-row gantt-header" });
    for (let d = 0; d < days; d += 5) {
      header.append(
        el("span", {
          class: "gantt-tick",
          style: `left:${d * DAY_PX}px`,
          text: addWorkingDays(model.start, d).slice(5)
        })
      );
    }
    const rows = result.tasks.map((t) => {
      const milestone = t.durationDays === 0;
      const bar = el("div", {
        class: `gantt-bar${t.critical ? " critical" : ""}${milestone ? " milestone" : ""}`,
        style: `left:${t.earlyStart * DAY_PX}px;width:${milestone ? 14 : Math.max(4, t.durationDays * DAY_PX - 2)}px`,
        title: `${t.name}: ${t.start} → ${t.finish}`
      });
      const slack =
        t.totalFloat > 0 && !milestone
          ? el("div", {
              class: "gantt-slack",
              style: `left:${t.earlyFinish * DAY_PX}px;width:${t.totalFloat * DAY_PX}px`
            })
          : "";
      return el("div", { class: "gantt-row" }, slack, bar);
    });
    gantt.replaceChildren(el("div", { class: "gantt-canvas", style: `width:${days * DAY_PX}px` }, header, ...rows));
  }

  function renderAll() {
    nameInput.value = model.name;
    startInput.value = model.start;
    try {
      result = scheduleProject(model);
      shell.clearMessages();
      if (result.warnings.length) shell.showWarnings("Schedule", result.warnings);
      summary.textContent = `${model.tasks.length} tasks · ${result.durationDays} working days · finishes ${result.finish}`;
    } catch (err) {
      result = null;
      shell.showError((err as Error).message);
      summary.textContent = "Schedule cannot be calculated";
    }
    renderTable();
    renderGantt();
  }

  renderAll();
}
