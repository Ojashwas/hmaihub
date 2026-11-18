/** Unambiguous alphabet: digits 2-9 and A-Z without I, L, O, U (30 symbols). */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_PREFIX = "HO1";
export const CODE_RANDOM_SYMBOLS = 27;
export const CODE_GROUP_SIZE = 4;
/** 27 symbols x log2(30) = 132.5 bits of entropy. */
export const CODE_ENTROPY_BITS = CODE_RANDOM_SYMBOLS * Math.log2(CODE_ALPHABET.length);

const N = CODE_ALPHABET.length;
const INDEX = new Map([...CODE_ALPHABET].map((c, i) => [c, i]));
const MAX_INPUT_LENGTH = 80;

function symbolIndex(c: string): number {
  const v = INDEX.get(c);
  if (v === undefined) throw new RangeError("Symbol outside the code alphabet");
  return v;
}

/** Luhn mod N check symbol; detects all single-symbol errors and most adjacent transpositions. */
export function computeCheckSymbol(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    let addend = factor * symbolIndex(body[i] as string);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return CODE_ALPHABET[(N - (sum % N)) % N] as string;
}

export function hasValidCheckSymbol(bodyWithCheck: string): boolean {
  let factor = 1;
  let sum = 0;
  for (let i = bodyWithCheck.length - 1; i >= 0; i--) {
    const c = bodyWithCheck[i] as string;
    if (!INDEX.has(c)) return false;
    let addend = factor * symbolIndex(c);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return sum % N === 0;
}

/** Formats 27 random symbols plus their check symbol as HO1-XXXX-...-XXXX. */
export function formatActivationCode(randomSymbols: string): string {
  if (randomSymbols.length !== CODE_RANDOM_SYMBOLS || ![...randomSymbols].every((c) => INDEX.has(c))) {
    throw new RangeError("Expected 27 symbols from the code alphabet");
  }
  const full = randomSymbols + computeCheckSymbol(randomSymbols);
  const groups: string[] = [];
  for (let i = 0; i < full.length; i += CODE_GROUP_SIZE) groups.push(full.slice(i, i + CODE_GROUP_SIZE));
  return `${CODE_PREFIX}-${groups.join("-")}`;
}

/**
 * Canonicalises user input (case, spaces, hyphens). Returns null for any
 * malformed code, including a failed transcription check. Ambiguous
 * characters are rejected rather than guessed.
 */
export function normalizeActivationCode(input: string): string | null {
  if (typeof input !== "string" || input.length > MAX_INPUT_LENGTH) return null;
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  if (!compact.startsWith(CODE_PREFIX)) return null;
  const body = compact.slice(CODE_PREFIX.length);
  if (body.length !== CODE_RANDOM_SYMBOLS + 1 || !hasValidCheckSymbol(body)) return null;
  return formatActivationCode(body.slice(0, CODE_RANDOM_SYMBOLS));
}
