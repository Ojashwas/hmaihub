import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import {
  addCalendarMonthsUtc,
  evaluateGrant,
  formatActivationCode,
  trustedKeySetFromJwks,
  verifyCompactJws
} from "@hyperoffice/licensing-core";
import {
  activateLicense,
  LicensingError,
  LocalDevelopmentSigner,
  verifyAuditChain,
  type GrantSigner,
  type LicensingDeps
} from "../../src/index.ts";
import {
  activationBody,
  at,
  clientContext,
  DAY,
  epoch,
  installation,
  issueOne,
  key,
  makeSigner,
  NOW,
  setup
} from "../helpers.ts";

const activate = (deps: LicensingDeps, body: object, idempotencyKey = key(), now = NOW, sourceIp = "198.51.100.7") =>
  activateLicense(deps, { body, idempotencyKey, sourceIp, now });

async function rejection(p: Promise<unknown>): Promise<LicensingError> {
  try {
    await p;
  } catch (err) {
    assert.ok(err instanceof LicensingError, String(err));
    return err;
  }
  return assert.fail("expected rejection");
}

describe("activation", () => {
  it("issues a grant that verifies offline with a six-calendar-month term and 14-day grace", async () => {
    const { deps, verificationKeys } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    const ins = installation();
    const res = await activate(deps, activationBody(code, ins));

    const evaluation = evaluateGrant(res.license_grant, clientContext(verificationKeys, ins, at(NOW, 1)));
    assert.equal(evaluation.status, "ALLOWED");
    assert.equal(evaluation.claims?.exp, addCalendarMonthsUtc(epoch(NOW), 6));
    assert.equal(evaluation.claims?.grace_until, addCalendarMonthsUtc(epoch(NOW), 6) + 14 * DAY);
    assert.equal(res.server_time, "2026-11-18T09:30:00.000Z");
    assert.match(res.support_reference, /^HSR-/);
    assert.match(res.activation_id, /^act_/);
  });

  it("rejects unknown, malformed, expired, and exhausted codes with an identical public error", async () => {
    const { deps } = await setup();
    const used = await issueOne(deps, "tpl_PRO6M");
    await activate(deps, activationBody(used, installation()));
    const expired = await issueOne(deps, "tpl_PRO6M", { redeemBy: at(NOW, -1) });
    const unknown = formatActivationCode("23456789ABCDEFGHJKMNPQRSTVW");

    const errors = await Promise.all(
      [used, expired, unknown, "not-a-code"].map((c) => rejection(activate(deps, activationBody(c, installation()))))
    );
    const publicShapes = errors.map((e) => {
      const shape: Record<string, unknown> = e.toPublic();
      delete shape["support_reference"];
      return JSON.stringify(shape);
    });
    assert.equal(new Set(publicShapes).size, 1, publicShapes.join("\n"));
    assert.equal(errors[0]?.publicCode, "ACTIVATION_FAILED");
    assert.deepEqual(
      errors.map((e) => e.internalReason),
      ["CODE_ACTIVATION_LIMIT", "CODE_REDEEM_BY_PASSED", "UNKNOWN_CODE", "MALFORMED_CODE"]
    );
  });

  it("enforces the licence installation limit across a multi-installation code", async () => {
    const { deps } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M", { maxInstallations: 5 });
    await activate(deps, activationBody(code, installation()));
    await activate(deps, activationBody(code, installation()));
    const err = await rejection(activate(deps, activationBody(code, installation())));
    assert.equal(err.internalReason, "LICENSE_INSTALLATION_LIMIT");
  });

  it("rejects the wrong product", async () => {
    const { deps } = await setup();
    const code = await issueOne(deps, "tpl_DOCONLY");
    const err = await rejection(activate(deps, activationBody(code, installation(), "hypersheet")));
    assert.equal(err.internalReason, "WRONG_PRODUCT");
  });

  it("is idempotent: a retry after a timeout returns the same result and consumes one activation", async () => {
    const { deps, repo } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    const body = activationBody(code, installation());
    const k = key();
    const [a, b] = await Promise.all([activate(deps, body, k), activate(deps, body, k)]);
    assert.deepEqual(a, b);
    const c = await activate(deps, body, k);
    assert.deepEqual(a, c);
    const state = repo.snapshot();
    assert.equal(state.activations.length, 1);
    assert.equal([...state.codes.values()][0]?.activationCount, 1);
  });

  it("rejects idempotency-key reuse with a different body and nonce replay", async () => {
    const { deps } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M", { maxInstallations: 2 });
    const k = key();
    const body = activationBody(code, installation());
    await activate(deps, body, k);
    assert.equal(
      (await rejection(activate(deps, { ...body, app_version: "0.2.0" }, k))).publicCode,
      "IDEMPOTENCY_CONFLICT"
    );
    const other = activationBody(code, installation());
    assert.equal((await rejection(activate(deps, { ...other, nonce: body.nonce }))).publicCode, "REPLAY_DETECTED");
  });

  it("allows only one of many simultaneous redemptions of a single-use code", async () => {
    const { deps, repo } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => activate(deps, activationBody(code, installation())))
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(repo.snapshot().licenses.size, 1);
  });

  it("re-activating the same installation reuses the slot and supersedes the previous grant", async () => {
    const { deps, repo } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    const ins = installation();
    await activate(deps, activationBody(code, ins));
    await activate(deps, activationBody(code, ins), key(), at(NOW, 3));
    const s = repo.snapshot();
    assert.equal([...s.codes.values()][0]?.activationCount, 1);
    assert.equal(s.grants.length, 2);
    assert.equal(s.grants[1]?.supersedesJti, s.grants[0]?.jti);
    const changed = await rejection(
      activate(deps, activationBody(code, { ...ins, fingerprint: installation().fingerprint }))
    );
    assert.equal(changed.internalReason, "DEVICE_CHANGED_REQUIRES_RESET");
  });

  it("starts the term at the contractual start date when the template specifies one", async () => {
    const { deps, repo, verificationKeys } = await setup();
    const start = epoch(at(NOW, 10));
    await repo.transaction(async (tx) => {
      const t = await tx.getTemplate("tpl_PRO6M");
      if (t) await tx.putTemplate({ ...t, templateId: "tpl_CONTRACT", contractStart: start });
    });
    const code = await issueOne(deps, "tpl_CONTRACT");
    const ins = installation();
    const res = await activate(deps, activationBody(code, ins));
    assert.equal(evaluateGrant(res.license_grant, clientContext(verificationKeys, ins, NOW)).status, "NOT_YET_VALID");
    const valid = evaluateGrant(res.license_grant, clientContext(verificationKeys, ins, at(NOW, 11)));
    assert.equal(valid.claims?.exp, addCalendarMonthsUtc(start, 6));
  });

  it("rolls back completely when the signing service fails (Key Vault unavailable)", async () => {
    const { deps, repo } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    const unavailable: GrantSigner = {
      kid: deps.signer.kid,
      alg: deps.signer.alg,
      environment: deps.signer.environment,
      publicJwk: (status) => deps.signer.publicJwk(status),
      sign: async () => {
        throw new Error("Key Vault: 503");
      }
    };
    const failing = { ...deps, signer: unavailable };
    const body = activationBody(code, installation());
    const k = key();
    await assert.rejects(activate(failing, body, k), /Key Vault/);
    const s = repo.snapshot();
    assert.equal([...s.codes.values()][0]?.activationCount, 0);
    assert.equal(s.licenses.size, 0);
    assert.ok((await activate(deps, body, k)).license_grant);
  });
});

describe("rate limiting", () => {
  it("limits attempts per source IP and returns retry-after", async () => {
    const { deps } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    for (let i = 0; i < 10; i++) await rejection(activate(deps, activationBody("HO1-bad", installation())));
    const err = await rejection(activate(deps, activationBody(code, installation())));
    assert.equal(err.publicCode, "RATE_LIMITED");
    assert.equal(err.httpStatus, 429);
    assert.ok((err.retryAfterSeconds ?? 0) > 0);
  });

  it("limits failed attempts per code hash across many IPs", async () => {
    const { deps } = await setup();
    const code = await issueOne(deps, "tpl_DOCONLY");
    for (let i = 0; i < 5; i++) {
      await rejection(activate(deps, activationBody(code, installation(), "hypersheet"), key(), NOW, `203.0.113.${i}`));
    }
    const err = await rejection(activate(deps, activationBody(code, installation()), key(), NOW, "203.0.113.200"));
    assert.equal(err.publicCode, "RATE_LIMITED");
  });

  it("resets after the window", async () => {
    const { deps } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    for (let i = 0; i < 10; i++) await rejection(activate(deps, activationBody("HO1-bad", installation())));
    assert.ok(await activate(deps, activationBody(code, installation()), key(), at(NOW, 1)));
  });
});

describe("audit and secrecy", () => {
  it("never stores the plaintext code and keeps a verifiable audit chain", async () => {
    const { deps, repo } = await setup();
    const code = await issueOne(deps, "tpl_PRO6M");
    const res = await activate(deps, activationBody(code, installation()));
    await rejection(activate(deps, activationBody(code, installation())));
    const s = repo.snapshot();
    const dump = JSON.stringify(s, (_k, v: unknown) => (v instanceof Map ? [...v.values()] : v));
    assert.ok(!dump.includes(code) && !dump.includes(code.replaceAll("-", "")), "plaintext code persisted");
    assert.ok(!JSON.stringify(s.audit).includes(res.license_grant), "grant persisted in audit");
    assert.deepEqual(verifyAuditChain(s.audit), { valid: true });
    assert.deepEqual(
      s.audit.map((e) => [e.action, e.result]),
      [
        ["codes.generate", "SUCCESS"],
        ["license.activate", "SUCCESS"],
        ["license.activate", "FAILURE"]
      ]
    );
  });

  it("detects audit tampering", async () => {
    const { deps, repo } = await setup();
    await activate(deps, activationBody(await issueOne(deps, "tpl_PRO6M"), installation()));
    const events = repo.snapshot().audit;
    const tampered = events.map((e, i) => (i === 0 ? { ...e, actor: "someone-else" } : e));
    assert.equal(verifyAuditChain(tampered).valid, false);
    assert.equal(verifyAuditChain(events.slice(1)).valid, false);
  });
});

describe("signing-key rotation", () => {
  it("validates grants from the retired key and the new key during overlap, and drops the old key afterwards", async () => {
    const { deps, signer: oldSigner } = await setup();
    const newSigner = makeSigner("ho-license-test-2");
    const insA = installation();
    const insB = installation();
    const oldGrant = (await activate(deps, activationBody(await issueOne(deps, "tpl_PRO6M"), insA))).license_grant;
    const rotated = { ...deps, signer: newSigner };
    const newGrant = (await activate(rotated, activationBody(await issueOne(deps, "tpl_PRO6M"), insB))).license_grant;

    assert.equal(
      verifyCompactJws(newGrant, { trustedKeys: trustedKeySetFromJwks([newSigner.publicJwk("active")], ["test"]) })
        .header.kid,
      "ho-license-test-2"
    );
    const overlap = trustedKeySetFromJwks([oldSigner.publicJwk("retired"), newSigner.publicJwk("active")], ["test"]);
    assert.equal(evaluateGrant(oldGrant, clientContext(overlap, insA, at(NOW, 1))).status, "ALLOWED");
    assert.equal(evaluateGrant(newGrant, clientContext(overlap, insB, at(NOW, 1))).status, "ALLOWED");

    const afterRemoval = trustedKeySetFromJwks([newSigner.publicJwk("active")], ["test"]);
    assert.equal(evaluateGrant(oldGrant, clientContext(afterRemoval, insA, at(NOW, 1))).reason, "UNKNOWN_KEY_ID");

    const compromised = trustedKeySetFromJwks(
      [oldSigner.publicJwk("compromised"), newSigner.publicJwk("active")],
      ["test"]
    );
    assert.equal(evaluateGrant(oldGrant, clientContext(compromised, insA, at(NOW, 1))).reason, "KEY_NOT_USABLE");
  });

  it("refuses to use the local signer for production keys", () => {
    const privateKey = generateKeyPairSync("ed25519").privateKey;
    for (const environment of ["production", "staging"]) {
      assert.throws(
        () =>
          new LocalDevelopmentSigner({ kid: "k", alg: "EdDSA", environment: environment as "development", privateKey }),
        /must not be used/
      );
    }
  });
});
