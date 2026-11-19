import type { LoadResult, PlanTask, ProjectModel } from "./models.ts";
import { addWorkingDays, nextWorkingDay, scheduleProject } from "./schedule.ts";
import { element, elements, escapeXml, parseXml, textContent, XML_DECLARATION } from "./xml.ts";

const NS = "http://schemas.microsoft.com/project";
const HOURS_PER_DAY = 8;

function durationToDays(iso: string): number {
  const m = /^PT(\d+(?:\.\d+)?)H(\d+(?:\.\d+)?)M(\d+(?:\.\d+)?)S$/.exec(iso.trim());
  if (!m) return 0;
  const hours = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return Math.round((hours / HOURS_PER_DAY) * 100) / 100;
}

export function readMspdi(text: string): LoadResult<ProjectModel> {
  const root = parseXml(text);
  if (root.name !== "Project" || root.attrs["xmlns"] !== NS)
    throw new Error("This file is not a Microsoft Project XML file");
  const warnings = new Set<string>();
  const start = textContent(element(root, "StartDate")).slice(0, 10) || new Date().toISOString().slice(0, 10);
  if (element(root, "Resources") && elements(element(root, "Resources"), "Resource").length > 1)
    warnings.add("Resources");
  if (element(root, "Assignments") && elements(element(root, "Assignments"), "Assignment").length)
    warnings.add("Resource assignments");
  if (elements(element(root, "Calendars"), "Calendar").length)
    warnings.add("Custom calendars (a Monday–Friday calendar is used)");

  const tasks: PlanTask[] = [];
  for (const t of elements(element(root, "Tasks"), "Task")) {
    const uid = Number(textContent(element(t, "UID")));
    if (!Number.isInteger(uid) || uid === 0) continue;
    if (textContent(element(t, "Summary")) === "1") warnings.add("Summary tasks (shown as normal tasks)");
    if (element(t, "ConstraintType") && textContent(element(t, "ConstraintType")) !== "0")
      warnings.add("Task constraints");
    if (textContent(element(t, "Baseline"))) warnings.add("Baselines");
    const predecessors: number[] = [];
    for (const link of elements(t, "PredecessorLink")) {
      const type = textContent(element(link, "Type")) || "1";
      if (type !== "1")
        warnings.add("Start-to-start, finish-to-finish, and start-to-finish links (treated as finish-to-start)");
      if (Number(textContent(element(link, "LinkLag")) || "0") !== 0) warnings.add("Link lag and lead");
      predecessors.push(Number(textContent(element(link, "PredecessorUID"))));
    }
    tasks.push({
      uid,
      name: textContent(element(t, "Name")),
      durationDays: durationToDays(textContent(element(t, "Duration"))),
      predecessors
    });
  }
  return {
    model: {
      kind: "project",
      name: textContent(element(root, "Name")) || "Untitled project",
      start: nextWorkingDay(start),
      tasks
    },
    warnings: [...warnings].sort()
  };
}

export function writeMspdi(project: ProjectModel): string {
  const scheduled = scheduleProject(project);
  const tasks = scheduled.tasks
    .map((t, i) => {
      const hours = Math.round(t.durationDays * HOURS_PER_DAY);
      const links = t.predecessors
        .map(
          (p) =>
            `<PredecessorLink><PredecessorUID>${p}</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`
        )
        .join("");
      return `<Task><UID>${t.uid}</UID><ID>${i + 1}</ID><Name>${escapeXml(t.name)}</Name><Start>${t.start}T08:00:00</Start><Finish>${t.finish}T17:00:00</Finish><Duration>PT${hours}H0M0S</Duration><DurationFormat>7</DurationFormat><Milestone>${hours === 0 ? 1 : 0}</Milestone>${links}</Task>`;
    })
    .join("\n    ");
  return `${XML_DECLARATION}<Project xmlns="${NS}">
  <Name>${escapeXml(project.name)}</Name>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${addWorkingDays(project.start, 0)}T08:00:00</StartDate>
  <FinishDate>${scheduled.finish}T17:00:00</FinishDate>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <Tasks>
    ${tasks}
  </Tasks>
</Project>
`;
}
