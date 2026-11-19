import type { PlanTask, ProjectModel } from "./models.ts";

export interface ScheduledTask extends PlanTask {
  /** Working-day offsets from the project start. */
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  critical: boolean;
  /** ISO dates (YYYY-MM-DD). */
  start: string;
  finish: string;
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  /** Total duration in working days. */
  durationDays: number;
  finish: string;
  warnings: string[];
}

export class ScheduleCycleError extends Error {}

const DAY_MS = 86_400_000;

function parseIsoDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new RangeError(`Invalid date ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Moves to the next working day (Monday–Friday) if the date is a weekend. */
export function nextWorkingDay(iso: string): string {
  let d = parseIsoDate(iso);
  while (isWeekend(d)) d = new Date(d.getTime() + DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** Date of the working day that is `offset` working days after `startIso` (offset 0 = start). */
export function addWorkingDays(startIso: string, offset: number): string {
  let d = parseIsoDate(nextWorkingDay(startIso));
  let remaining = Math.max(0, Math.floor(offset));
  while (remaining > 0) {
    d = new Date(d.getTime() + DAY_MS);
    if (!isWeekend(d)) remaining--;
  }
  return d.toISOString().slice(0, 10);
}

/** Critical-path schedule with finish-to-start links on a Monday–Friday calendar. */
export function scheduleProject(project: ProjectModel): ScheduleResult {
  const warnings: string[] = [];
  const byUid = new Map(project.tasks.map((t) => [t.uid, t]));
  const preds = new Map<number, number[]>();
  for (const t of project.tasks) {
    const valid = t.predecessors.filter((p) => {
      if (byUid.has(p) && p !== t.uid) return true;
      warnings.push(`Task "${t.name}" references missing predecessor ${p}; link ignored`);
      return false;
    });
    preds.set(t.uid, valid);
  }

  const indegree = new Map(project.tasks.map((t) => [t.uid, (preds.get(t.uid) ?? []).length]));
  const successors = new Map<number, number[]>();
  for (const [uid, ps] of preds) for (const p of ps) successors.set(p, [...(successors.get(p) ?? []), uid]);
  const queue = project.tasks.filter((t) => indegree.get(t.uid) === 0).map((t) => t.uid);
  const order: number[] = [];
  while (queue.length) {
    const uid = queue.shift() as number;
    order.push(uid);
    for (const s of successors.get(uid) ?? []) {
      const d = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, d);
      if (d === 0) queue.push(s);
    }
  }
  if (order.length !== project.tasks.length) throw new ScheduleCycleError("The task links contain a loop");

  const dur = (uid: number) => Math.max(0, Math.round((byUid.get(uid) as PlanTask).durationDays));
  const es = new Map<number, number>();
  const ef = new Map<number, number>();
  for (const uid of order) {
    const start = Math.max(0, ...(preds.get(uid) ?? []).map((p) => ef.get(p) ?? 0));
    es.set(uid, start);
    ef.set(uid, start + dur(uid));
  }
  const projectDuration = Math.max(0, ...ef.values());
  const ls = new Map<number, number>();
  const lf = new Map<number, number>();
  for (const uid of [...order].reverse()) {
    const finish = Math.min(projectDuration, ...(successors.get(uid) ?? []).map((s) => ls.get(s) ?? projectDuration));
    lf.set(uid, finish);
    ls.set(uid, finish - dur(uid));
  }

  const tasks = project.tasks.map((t): ScheduledTask => {
    const e = es.get(t.uid) ?? 0;
    const f = ef.get(t.uid) ?? 0;
    const float = (ls.get(t.uid) ?? 0) - e;
    return {
      ...t,
      predecessors: preds.get(t.uid) ?? [],
      earlyStart: e,
      earlyFinish: f,
      lateStart: ls.get(t.uid) ?? 0,
      lateFinish: lf.get(t.uid) ?? 0,
      totalFloat: float,
      critical: float === 0,
      start: addWorkingDays(project.start, e),
      finish: addWorkingDays(project.start, f > e ? f - 1 : e)
    };
  });
  return {
    tasks,
    durationDays: projectDuration,
    finish: addWorkingDays(project.start, projectDuration > 0 ? projectDuration - 1 : 0),
    warnings
  };
}
