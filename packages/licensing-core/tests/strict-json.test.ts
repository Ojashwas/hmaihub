import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import { LicenseTokenError, parseStrictJson } from "../src/index.ts";

const code = (fn: () => unknown, expected: string) =>
  assert.throws(fn, (e: unknown) => e instanceof LicenseTokenError && e.code === expected);

describe("strict JSON", () => {
  it("parses ordinary JSON identically to JSON.parse", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const text = JSON.stringify(value);
        assert.deepEqual(JSON.parse(JSON.stringify(parseStrictJson(text, 128))), JSON.parse(text));
      })
    );
  });

  it("detects duplicate members, including escaped duplicates", () => {
    code(() => parseStrictJson('{"a":1,"a":2}'), "DUPLICATE_JSON_MEMBER");
    code(() => parseStrictJson('{"a":1,"\\u0061":2}'), "DUPLICATE_JSON_MEMBER");
    code(() => parseStrictJson('{"x":{"b":1,"b":1}}'), "DUPLICATE_JSON_MEMBER");
  });

  it("rejects non-JSON syntax", () => {
    for (const bad of ["", "{", "{'a':1}", "[1,]", '{"a":1,}', "01", "NaN", "1 2", '"\u0001"', '{"a":1}x', "tru"]) {
      code(() => parseStrictJson(bad), "INVALID_JSON");
    }
  });

  it("limits nesting depth", () => {
    code(() => parseStrictJson("[".repeat(40) + "]".repeat(40)), "INVALID_JSON");
  });

  it("does not allow prototype pollution through __proto__", () => {
    const parsed = parseStrictJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    assert.equal(Object.getPrototypeOf(parsed), null);
    assert.equal(({} as Record<string, unknown>)["polluted"], undefined);
  });
});
