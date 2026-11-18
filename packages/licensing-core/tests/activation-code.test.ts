import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import {
  CODE_ALPHABET,
  CODE_ENTROPY_BITS,
  CODE_RANDOM_SYMBOLS,
  formatActivationCode,
  normalizeActivationCode
} from "../src/index.ts";

const symbols = fc.string({
  unit: fc.constantFrom(...CODE_ALPHABET),
  minLength: CODE_RANDOM_SYMBOLS,
  maxLength: CODE_RANDOM_SYMBOLS
});

describe("activation code format", () => {
  it("alphabet excludes confusable characters and has 30 symbols", () => {
    assert.equal(CODE_ALPHABET.length, 30);
    for (const c of "O0I1LU") assert.ok(!CODE_ALPHABET.includes(c), c);
    assert.ok(CODE_ENTROPY_BITS >= 128);
  });

  it("formats as HO1 plus seven groups of four", () => {
    const code = formatActivationCode("23456789ABCDEFGHJKMNPQRSTVW");
    assert.match(code, /^HO1(-[2-9A-HJKMNP-TV-Z]{4}){7}$/);
  });

  it("property: formatted codes normalise to themselves regardless of case and spacing", () => {
    fc.assert(
      fc.property(symbols, (body) => {
        const code = formatActivationCode(body);
        assert.equal(normalizeActivationCode(code), code);
        assert.equal(normalizeActivationCode(code.toLowerCase().replaceAll("-", " ")), code);
        assert.equal(normalizeActivationCode(`  ${code.replaceAll("-", "")}  `), code);
      })
    );
  });

  it("property: any single-symbol substitution is detected", () => {
    fc.assert(
      fc.property(symbols, fc.nat(CODE_RANDOM_SYMBOLS), fc.constantFrom(...CODE_ALPHABET), (body, pos, replacement) => {
        const compact = formatActivationCode(body).replaceAll("-", "");
        const index = 3 + pos;
        fc.pre(compact[index] !== replacement);
        const mutated = compact.slice(0, index) + replacement + compact.slice(index + 1);
        assert.equal(normalizeActivationCode(mutated), null);
      })
    );
  });

  it("property: adjacent transpositions of distinct symbols are detected in nearly all cases", () => {
    let detected = 0;
    let total = 0;
    fc.assert(
      fc.property(symbols, fc.nat(CODE_RANDOM_SYMBOLS - 1), (body, pos) => {
        const compact = formatActivationCode(body).replaceAll("-", "");
        const i = 3 + pos;
        fc.pre(compact[i] !== compact[i + 1]);
        total++;
        const swapped = compact.slice(0, i) + compact[i + 1] + compact[i] + compact.slice(i + 2);
        if (normalizeActivationCode(swapped) === null) detected++;
      }),
      { numRuns: 2000 }
    );
    assert.ok(detected / total > 0.95, `detected ${detected}/${total}`);
  });

  it("rejects malformed input without guessing", () => {
    const valid = formatActivationCode("23456789ABCDEFGHJKMNPQRSTVW");
    assert.equal(normalizeActivationCode(valid.replace("HO1", "HO2")), null);
    assert.equal(normalizeActivationCode(valid.slice(0, -1)), null);
    assert.equal(normalizeActivationCode(`${valid}2`), null);
    assert.equal(normalizeActivationCode(valid.replace("2", "Z").replace("3", "O")), null);
    assert.equal(normalizeActivationCode("x".repeat(500)), null);
    assert.equal(normalizeActivationCode(""), null);
  });
});
