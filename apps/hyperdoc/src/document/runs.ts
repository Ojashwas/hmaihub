import type { TextRun } from "@hyperoffice/office-formats/models";

export type Fmt = Omit<TextRun, "text">;

/** Appends text to the run list, merging with the previous run when formatting matches. */
export function pushRun(runs: TextRun[], text: string, fmt: Fmt): void {
  if (!text) return;
  const last = runs[runs.length - 1];
  const same =
    last && !!last.bold === !!fmt.bold && !!last.italic === !!fmt.italic && !!last.underline === !!fmt.underline;
  if (last && same) last.text += text;
  else
    runs.push({
      text,
      ...(fmt.bold ? { bold: true } : {}),
      ...(fmt.italic ? { italic: true } : {}),
      ...(fmt.underline ? { underline: true } : {})
    });
}
