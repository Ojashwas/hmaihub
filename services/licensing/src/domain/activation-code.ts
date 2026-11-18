import { randomBytes } from "node:crypto";
import { CODE_ALPHABET, CODE_RANDOM_SYMBOLS, formatActivationCode } from "@hyperoffice/licensing-core";

const N = CODE_ALPHABET.length;
// Largest multiple of 30 that fits in a byte; bytes at or above it are rejected to avoid modulo bias.
const REJECTION_LIMIT = 256 - (256 % N);

export type RandomSource = (size: number) => Uint8Array;

/**
 * Server-side only. Draws from the OS CSPRNG, maps bytes to the code
 * alphabet with rejection sampling, then adds the HO1 prefix and check symbol.
 */
export function generateActivationCode(random: RandomSource = randomBytes): string {
  let symbols = "";
  while (symbols.length < CODE_RANDOM_SYMBOLS) {
    for (const b of random(32)) {
      if (b >= REJECTION_LIMIT) continue;
      symbols += CODE_ALPHABET[b % N];
      if (symbols.length === CODE_RANDOM_SYMBOLS) break;
    }
  }
  return formatActivationCode(symbols);
}
