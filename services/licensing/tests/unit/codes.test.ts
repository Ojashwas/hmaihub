import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import {
  CODE_ALPHABET,
  CODE_RANDOM_SYMBOLS,
  formatActivationCode,
  normalizeActivationCode
} from "@hyperoffice/licensing-core";
import { generateActivationCode, hashActivationCode, issueCodes, LicensingError } from "../../src/index.ts";
import { epoch, NOW, setup } from "../helpers.ts";

describe("activation code generation", () => {
  it("produces well-formed, normalisable, unique codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = generateActivationCode();
      assert.equal(normalizeActivationCode(code), code);
      seen.add(code);
    }
    assert.equal(seen.size, 2000);
  });

  it("rejects biased bytes (rejection sampling) instead of reducing them modulo 30", () => {
    let call = 0;
    let next = 0;
    // First draw is entirely rejectable; later draws interleave rejectable bytes with 0, 1, 2, ...
    const source = (size: number) => {
      call++;
      if (call === 1) return new Uint8Array(size).fill(255);
      return Uint8Array.from({ length: size }, (_, i) => (i % 2 === 0 ? 240 + (i % 16) : next++));
    };
    const code = generateActivationCode(source);
    assert.equal(code, formatActivationCode(CODE_ALPHABET.slice(0, CODE_RANDOM_SYMBOLS)));
  });

  it("has an approximately uniform symbol distribution", () => {
    const counts = new Map<string, number>();
    const n = 3000;
    for (let i = 0; i < n; i++) {
      for (const c of generateActivationCode().slice(4).replaceAll("-", "").slice(0, CODE_RANDOM_SYMBOLS)) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const expected = (n * CODE_RANDOM_SYMBOLS) / 30;
    for (const c of CODE_ALPHABET) {
      const v = counts.get(c) ?? 0;
      assert.ok(Math.abs(v - expected) / expected < 0.1, `${c}: ${v} vs ${expected}`);
    }
  });

  it("HMAC lookup hashes depend on the pepper", () => {
    const code = generateActivationCode();
    assert.notEqual(hashActivationCode(randomBytes(32), code), hashActivationCode(randomBytes(32), code));
    assert.throws(() => hashActivationCode(randomBytes(16), code));
  });
});

describe("code issuance", () => {
  const base = {
    templateId: "tpl_PRO6M",
    redeemBy: epoch(NOW) + 86_400 * 90,
    maxInstallations: 1,
    channel: "reseller",
    orderId: "ord_BULK0000000001",
    createdBy: "operator@hyperoffice.example",
    now: NOW
  };

  it("requires a second, different approver above the bulk threshold", async () => {
    const { deps } = await setup();
    await assert.rejects(
      issueCodes(deps, { ...base, quantity: 51 }),
      (e: unknown) => e instanceof LicensingError && e.publicCode === "APPROVAL_REQUIRED"
    );
    await assert.rejects(issueCodes(deps, { ...base, quantity: 51, approvedBy: base.createdBy }), LicensingError);
    const codes = await issueCodes(deps, { ...base, quantity: 51, approvedBy: "manager@hyperoffice.example" });
    assert.equal(codes.length, 51);
  });

  it("rejects unknown templates and invalid quantities", async () => {
    const { deps } = await setup();
    await assert.rejects(issueCodes(deps, { ...base, templateId: "tpl_MISSING", quantity: 1 }), LicensingError);
    await assert.rejects(issueCodes(deps, { ...base, quantity: 0 }), LicensingError);
  });
});
