/** Parses "1, 2; 3" style predecessor input into unique positive task IDs, excluding the task itself. */
export function parsePredecessors(text: string, selfUid?: number): number[] {
  return [
    ...new Set(
      text
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0 && n !== selfUid)
    )
  ];
}
