import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { FILE_MEDIA_TYPES, type DetectedFormat } from "../src/index.ts";

const root = new URL("../../../", import.meta.url);
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });

describe("capability manifests", () => {
  const validate = ajv.compile(read("schemas/hyperoffice/capability-manifest.schema.json") as object);
  const files = readdirSync(new URL("compatibility/manifests/", root)).filter((f) => f.endsWith(".json"));

  it("exist", () => assert.ok(files.length >= 5));

  for (const file of files) {
    it(`${file} is schema-valid, consistent with the detector, and backed by existing tests`, () => {
      const manifest = read(`compatibility/manifests/${file}`) as {
        format: DetectedFormat;
        mediaType: string;
        testCoverage: string[];
        reaInvestigations: string[];
      };
      assert.ok(validate(manifest), JSON.stringify(validate.errors));
      assert.equal(manifest.mediaType, FILE_MEDIA_TYPES[manifest.format]);
      for (const path of [...manifest.testCoverage, ...manifest.reaInvestigations]) {
        assert.ok(existsSync(new URL(path, root)), `${path} does not exist`);
      }
    });
  }

  it("the schema rejects an L5 claim without REA evidence and a compatibility report", () => {
    const manifest = read("compatibility/manifests/docx.json") as Record<string, unknown>;
    assert.equal(validate({ ...manifest, roundTripLevel: "L5" }), false);
  });
});
