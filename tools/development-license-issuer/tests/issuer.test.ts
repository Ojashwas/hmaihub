import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { evaluateGrant, LicenseTokenError, trustedKeySetFromJwks } from "@hyperoffice/licensing-core";
import { createInstallationId } from "@hyperoffice/licensing-client";
import {
  assertNotProduction,
  DEV_AUDIENCE,
  DEV_ISSUER,
  issueDevelopmentGrant,
  loadOrCreateDevKey
} from "../src/index.ts";

const dir = mkdtempSync(join(tmpdir(), "ho-dev-keys-"));
after(() => rmSync(dir, { recursive: true, force: true }));

describe("development licence issuer", () => {
  it("issues a grant that a development build can verify offline", () => {
    const key = loadOrCreateDevKey(dir);
    const installationId = createInstallationId();
    const deviceBinding = `sha256:${"Q".repeat(43)}`;
    const { token } = issueDevelopmentGrant(key, { installationId, deviceBinding, products: ["hyperdoc"] });
    const keys = JSON.parse(readFileSync(join(dir, "ho-license-dev.public.json"), "utf8")) as { keys: unknown[] };
    const result = evaluateGrant(token, {
      trustedKeys: trustedKeySetFromJwks(keys.keys, ["development"]),
      expectedIssuer: DEV_ISSUER,
      expectedAudience: DEV_AUDIENCE,
      product: "hyperdoc",
      installationId,
      deviceBinding,
      now: Math.floor(Date.now() / 1000)
    });
    assert.equal(result.status, "ALLOWED");
    assert.equal(result.claims?.license_mode, "development");
  });

  it("reuses the same key and kid across runs", () => {
    assert.equal(loadOrCreateDevKey(dir).kid, loadOrCreateDevKey(dir).kid);
  });

  it("cannot be trusted by a production trust store", () => {
    const key = loadOrCreateDevKey(dir);
    assert.throws(() => trustedKeySetFromJwks([key.publicJwk], ["production"]), LicenseTokenError);
  });

  it("refuses to run in production or staging", () => {
    assert.throws(() => assertNotProduction({ HYPEROFFICE_ENV: "production" }), /disabled/);
    assert.throws(() => assertNotProduction({ HYPEROFFICE_ENV: "Staging" }), /disabled/);
    assert.doesNotThrow(() => assertNotProduction({}));
  });

  it("the repository ignores the development key directory", () => {
    const gitignore = readFileSync(new URL("../../../.gitignore", import.meta.url), "utf8");
    assert.match(gitignore, /^\.dev-keys\/$/m);
  });
});
