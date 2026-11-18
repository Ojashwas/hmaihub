import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addCalendarMonthsUtc, evaluateGrant } from "@hyperoffice/licensing-core";
import { activateLicense, LicensingError, renewLicense, type LicensingDeps } from "../../src/index.ts";
import { activationBody, at, clientContext, epoch, installation, issueOne, key, NOW, setup } from "../helpers.ts";
import { randomBytes } from "node:crypto";

async function activated(start = NOW) {
  const env = await setup();
  const ins = installation();
  const res = await activateLicense(env.deps, {
    body: activationBody(await issueOne(env.deps, "tpl_PRO6M"), ins),
    idempotencyKey: key(),
    sourceIp: "198.51.100.7",
    now: start
  });
  const claims = evaluateGrant(res.license_grant, clientContext(env.verificationKeys, ins, start)).claims;
  assert.ok(claims);
  return { ...env, ins, grant: res.license_grant, claims };
}

const renewalBody = (code: string, grant: string, ins: { id: string; fingerprint: string }) => ({
  extension_code: code,
  current_license_grant: grant,
  installation_id: ins.id,
  device_fingerprint: ins.fingerprint,
  nonce: randomBytes(16).toString("base64url"),
  client_time: "2026-12-01T00:00:00Z"
});

const renew = (deps: LicensingDeps, licenseId: string, body: object, now: Date, idempotencyKey = key()) =>
  renewLicense(deps, { licenseId, body, idempotencyKey, sourceIp: "198.51.100.8", now });

async function reason(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    assert.ok(err instanceof LicensingError, String(err));
    return err.internalReason;
  }
  return assert.fail("expected rejection");
}

describe("renewal", () => {
  it("early renewal preserves remaining time", async () => {
    const { deps, ins, grant, claims, verificationKeys } = await activated();
    const code = await issueOne(deps, "tpl_RENEW6M");
    const res = await renew(deps, claims.license_id, renewalBody(code, grant, ins), at(NOW, 30));
    const renewed = evaluateGrant(res.license_grant, clientContext(verificationKeys, ins, at(NOW, 31)));
    assert.equal(renewed.status, "ALLOWED");
    assert.equal(renewed.claims?.exp, addCalendarMonthsUtc(claims.exp, 6));
    assert.equal(renewed.claims?.license_version, 2);
  });

  it("late renewal after expiry starts from server time and accepts the expired grant", async () => {
    const { deps, ins, grant, claims, verificationKeys } = await activated();
    const late = at(new Date(claims.grace_until * 1000), 5);
    const res = await renew(
      deps,
      claims.license_id,
      renewalBody(await issueOne(deps, "tpl_RENEW6M", { redeemBy: at(late, 10) }), grant, ins),
      late
    );
    const renewed = evaluateGrant(res.license_grant, clientContext(verificationKeys, ins, late));
    assert.equal(renewed.claims?.exp, addCalendarMonthsUtc(epoch(late), 6));
    assert.equal(renewed.status, "ALLOWED");
  });

  it("month-end renewal clamps per calendar-month policy", async () => {
    const start = new Date("2026-08-31T12:00:00Z");
    const { deps, ins, grant, claims } = await activated(start);
    assert.equal(new Date(claims.exp * 1000).toISOString(), "2027-02-28T12:00:00.000Z");
    const res = await renew(
      deps,
      claims.license_id,
      renewalBody(await issueOne(deps, "tpl_RENEW6M"), grant, ins),
      at(start, 1)
    );
    assert.equal(res.new_expiry, "2027-08-28T12:00:00.000Z");
  });

  it("consumes a renewal code exactly once, even under concurrency", async () => {
    const { deps, ins, grant, claims } = await activated();
    const code = await issueOne(deps, "tpl_RENEW6M");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => renew(deps, claims.license_id, renewalBody(code, grant, ins), at(NOW, 1)))
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      await reason(renew(deps, claims.license_id, renewalBody(code, grant, ins), at(NOW, 2))),
      "CODE_REDEEMED"
    );
  });

  it("returns the same result for an idempotent retry", async () => {
    const { deps, ins, grant, claims } = await activated();
    const body = renewalBody(await issueOne(deps, "tpl_RENEW6M"), grant, ins);
    const k = key();
    assert.deepEqual(
      await renew(deps, claims.license_id, body, at(NOW, 1), k),
      await renew(deps, claims.license_id, body, at(NOW, 1), k)
    );
  });

  it("rejects codes bound to another customer, activation codes, and tampered grants", async () => {
    const { deps, ins, grant, claims } = await activated();
    const otherCustomer = await issueOne(deps, "tpl_RENEW6M", { customerId: "cus_SOMEONEELSE0001" });
    assert.equal(
      await reason(renew(deps, claims.license_id, renewalBody(otherCustomer, grant, ins), at(NOW, 1))),
      "WRONG_CUSTOMER"
    );
    const activationCode = await issueOne(deps, "tpl_PRO6M");
    assert.equal(
      await reason(renew(deps, claims.license_id, renewalBody(activationCode, grant, ins), at(NOW, 1))),
      "NOT_A_RENEWAL_CODE"
    );
    const [h, , s] = grant.split(".");
    const payload = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 1e7 })).toString("base64url");
    const renewalCode = await issueOne(deps, "tpl_RENEW6M");
    assert.equal(
      await reason(renew(deps, claims.license_id, renewalBody(renewalCode, `${h}.${payload}.${s}`, ins), at(NOW, 1))),
      "PRESENTED_GRANT_INVALID_SIGNATURE"
    );
    assert.equal(
      await reason(renew(deps, "lic_SOMEOTHERLICENSE1", renewalBody(renewalCode, grant, ins), at(NOW, 1))),
      "PRESENTED_GRANT_MISMATCH"
    );
  });

  it("feature codes add entitlements and raise limits without changing the term", async () => {
    const { deps, ins, grant, claims, verificationKeys } = await activated();
    const res = await renew(
      deps,
      claims.license_id,
      renewalBody(await issueOne(deps, "tpl_TRACK"), grant, ins),
      at(NOW, 1)
    );
    const c = evaluateGrant(res.license_grant, clientContext(verificationKeys, ins, at(NOW, 1))).claims;
    assert.ok(c?.features.includes("hyperdoc.track_changes"));
    assert.equal(c?.limits.installations, claims.limits.installations + 1);
    assert.equal(c?.exp, claims.exp);
  });
});
