import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleCompactJws,
  encodeSigningInput,
  formatActivationCode,
  LICENSE_TOKEN_TYPE,
  PATTERNS,
  signWithLocalKey,
  trustedKeySetFromJwks,
  type GrantEvaluation
} from "@hyperoffice/licensing-core";
import {
  rfc8032PrivateKey,
  SAMPLE_CLAIMS,
  TEST_AUDIENCE,
  TEST_DEVICE_BINDING,
  TEST_EDDSA_KID,
  TEST_EDDSA_PUBLIC_JWK,
  TEST_INSTALLATION_ID,
  TEST_ISSUER
} from "@hyperoffice/licensing-core/test-vectors";
import {
  ClockGuard,
  buildDiagnostics,
  computeDeviceFingerprint,
  computeSignalHashes,
  createInstallationId,
  GrantStore,
  InvalidActivationCodeFormat,
  matchDevice,
  MemorySecureStore,
  prepareActivation,
  prepareRenewal,
  validateInstalledLicense,
  type LocalLicenseContext,
  type SecureStore
} from "../src/index.ts";

const trustedKeys = trustedKeySetFromJwks([TEST_EDDSA_PUBLIC_JWK], ["test"]);
const ctx: LocalLicenseContext = {
  trustedKeys,
  expectedIssuer: TEST_ISSUER,
  expectedAudience: TEST_AUDIENCE,
  product: "hyperdoc",
  installationId: TEST_INSTALLATION_ID,
  deviceBinding: TEST_DEVICE_BINDING
};

function grant(overrides: Partial<typeof SAMPLE_CLAIMS> = {}): string {
  const input = encodeSigningInput(
    { typ: LICENSE_TOKEN_TYPE, alg: "EdDSA", kid: TEST_EDDSA_KID, ver: 1 },
    { ...SAMPLE_CLAIMS, ...overrides }
  );
  return assembleCompactJws(input, signWithLocalKey("EdDSA", input, rfc8032PrivateKey()));
}

/** Controllable clocks: `wall` is the user-adjustable clock, `mono` the monotonic clock. */
function clocks(wall: number) {
  const t = { wall, mono: 1000 };
  return { t, sources: { wallNow: () => t.wall, monotonicNow: () => t.mono } };
}

const DAY = 86_400;
const iat = SAMPLE_CLAIMS.iat;

describe("clock-rollback protection", () => {
  it("accepts normal forward time and small corrections within tolerance", () => {
    const { t, sources } = clocks(iat + DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat + DAY }, sources);
    t.wall += 3600;
    t.mono += 3600;
    assert.equal(guard.check().ok, true);
    t.wall -= 300;
    assert.equal(guard.check().ok, true);
  });

  it("flags a wall clock set before the highest observed time", () => {
    const { sources } = clocks(iat + 10 * DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat + 30 * DAY }, sources);
    assert.equal(guard.check().issue, "WALL_CLOCK_BEFORE_TRUSTED_TIME");
  });

  it("flags a backward jump during a running session", () => {
    const { t, sources } = clocks(iat + DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat }, sources);
    t.mono += 60;
    t.wall -= 2 * DAY;
    assert.equal(guard.check().issue, "WALL_CLOCK_BEFORE_TRUSTED_TIME");
    const fresh = clocks(iat + DAY);
    const g2 = new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat }, fresh.sources);
    fresh.t.mono += 2 * DAY;
    fresh.t.wall += 60;
    assert.equal(g2.check().issue, "BACKWARD_JUMP_IN_SESSION");
  });

  it("recovers after an authenticated server time is recorded", () => {
    const { sources } = clocks(iat + 10 * DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat + 400 * DAY }, sources);
    assert.equal(guard.check().ok, false);
    guard.recordTrustedServerTime(iat + 10 * DAY);
    assert.equal(guard.check().ok, true);
  });

  it("never reports time earlier than the trusted floor", () => {
    const { sources } = clocks(iat + 10 * DAY - 120);
    const guard = new ClockGuard(
      { lastTrustedServerTime: iat + 10 * DAY, highestObservedTime: iat + 10 * DAY },
      sources
    );
    assert.equal(guard.check().now, iat + 10 * DAY);
  });
});

describe("offline validation", () => {
  it("validates a grant offline", () => {
    const { sources } = clocks(iat + DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat }, sources);
    assert.equal(validateInstalledLicense(grant(), ctx, guard).status, "ALLOWED");
  });

  it("does not let a clock rollback revive an expired grant", () => {
    const { sources } = clocks(iat + 30 * DAY);
    const guard = new ClockGuard(
      { lastTrustedServerTime: iat, highestObservedTime: SAMPLE_CLAIMS.grace_until + DAY },
      sources
    );
    assert.equal(validateInstalledLicense(grant(), ctx, guard).status, "CLOCK_TAMPER_SUSPECTED");
  });

  it("flags a clock set before the grant was signed", () => {
    const { sources } = clocks(iat - 30 * DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: 0, highestObservedTime: 0 }, sources);
    const r = validateInstalledLicense(grant(), ctx, guard);
    assert.equal(r.status, "CLOCK_TAMPER_SUSPECTED");
    assert.equal(r.reason, "BEFORE_SIGNED_ISSUE_TIME");
  });

  it("never masks a signature failure as a clock problem", () => {
    const { sources } = clocks(iat - 30 * DAY);
    const guard = new ClockGuard({ lastTrustedServerTime: 0, highestObservedTime: iat }, sources);
    const [h, , s] = grant().split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...SAMPLE_CLAIMS, exp: 4e9 })).toString("base64url")}.${s}`;
    assert.equal(validateInstalledLicense(forged, ctx, guard).status, "INVALID_SIGNATURE");
  });
});

describe("device binding", () => {
  const salt = "hyperoffice-desktop-v1";
  const signals = {
    machine_id: "4C4C4544-0042-3510-8048-B4C04F4E3132",
    os_install_id: "00330-80000-00000-AA123",
    system_volume_id: "C0FFEE12",
    board_serial: "BSN12345",
    cpu_model: "Intel(R) Core(TM) i7",
    os_family: "windows"
  };

  it("produces a stable fingerprint in the grant format", () => {
    const a = computeDeviceFingerprint(salt, signals);
    assert.match(a, PATTERNS.deviceBinding);
    assert.equal(computeDeviceFingerprint(salt, { ...signals, machine_id: signals.machine_id.toLowerCase() }), a);
    assert.notEqual(computeDeviceFingerprint("other-product", signals), a);
  });

  it("tolerates disk replacement and OS update but not a different machine", () => {
    const recorded = computeSignalHashes(salt, signals);
    const diskSwap = computeSignalHashes(salt, {
      ...signals,
      system_volume_id: "NEWDISK1",
      cpu_model: "Intel(R) Core(TM) i9"
    });
    assert.equal(matchDevice(recorded, diskSwap).matched, true);
    const other = computeSignalHashes(salt, { ...signals, machine_id: "X", os_install_id: "Y", board_serial: "Z" });
    assert.equal(matchDevice(recorded, other).matched, false);
  });

  it("rejects non-allowlisted signals such as MAC addresses", () => {
    assert.throws(() => computeDeviceFingerprint(salt, { ...signals, mac_address: "00:11:22:33:44:55" } as never));
    assert.throws(() => computeDeviceFingerprint(salt, { os_family: "windows" }));
  });
});

describe("grant storage", () => {
  const validate = (token: string): GrantEvaluation => {
    const { sources } = clocks(iat + DAY);
    return validateInstalledLicense(
      token,
      ctx,
      new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat }, sources)
    );
  };

  it("installs a valid grant and replaces it with a newer version", async () => {
    const store = new GrantStore(new MemorySecureStore(), validate);
    assert.equal((await store.install(grant(), iat)).installed, true);
    const renewed = await store.install(
      grant({
        license_version: 2,
        exp: SAMPLE_CLAIMS.exp + 180 * DAY,
        grace_until: SAMPLE_CLAIMS.grace_until + 180 * DAY
      }),
      iat + DAY
    );
    assert.equal(renewed.installed, true);
    const record = await store.read();
    assert.equal(record?.current.licenseVersion, 2);
    assert.equal(record?.superseded?.licenseVersion, 1);
  });

  it("rejects rollback to an older or equal licence version", async () => {
    const store = new GrantStore(new MemorySecureStore(), validate);
    await store.install(grant({ license_version: 3 }), iat);
    const result = await store.install(grant({ license_version: 2 }), iat);
    assert.deepEqual(result.installed ? null : result.reason, "ROLLBACK_REJECTED");
  });

  it("rejects an invalid grant without touching the stored one", async () => {
    const store = new GrantStore(new MemorySecureStore(), validate);
    await store.install(grant(), iat);
    const r = await store.install(grant({ installation_id: "ins_01JSOMEONEELSE01", license_version: 2 }), iat);
    assert.equal(r.installed ? null : r.reason, "VALIDATION_FAILED");
    assert.equal((await store.read())?.current.licenseVersion, 1);
  });

  it("keeps the previous grant when the secure store write fails", async () => {
    const backing = new MemorySecureStore();
    let fail = false;
    const flaky: SecureStore = {
      read: (k) => backing.read(k),
      write: async (k, v) => {
        if (fail) throw new Error("disk full");
        await backing.write(k, v);
      },
      delete: (k) => backing.delete(k)
    };
    const store = new GrantStore(flaky, validate);
    await store.install(grant(), iat);
    fail = true;
    const r = await store.install(grant({ license_version: 2 }), iat);
    assert.equal(r.installed ? null : r.reason, "STORAGE_FAILED");
    assert.equal((await store.read())?.current.licenseVersion, 1);
  });
});

describe("activation and renewal requests", () => {
  const validCode = formatActivationCode("23456789ABCDEFGHJKMNPQRSTVW");
  const missingCheckSymbol = validCode.slice(0, -1);
  const activationInput = (code: string) => ({
    code,
    product: "hyperoffice-suite",
    installation_id: TEST_INSTALLATION_ID,
    device_fingerprint: TEST_DEVICE_BINDING,
    app_version: "0.1.0",
    platform: "windows" as const,
    platform_version: "11",
    now: new Date("2026-11-18T09:30:00Z")
  });

  it("creates installation ids matching the grant pattern", () => {
    for (let i = 0; i < 50; i++) assert.match(createInstallationId(), PATTERNS.installationId);
  });

  it("rejects malformed codes locally", () => {
    assert.throws(() => prepareActivation(activationInput("HO1-0000")), InvalidActivationCodeFormat);
    assert.throws(
      () =>
        prepareRenewal({
          extensionCode: missingCheckSymbol,
          currentGrant: grant(),
          installationId: TEST_INSTALLATION_ID,
          deviceFingerprint: TEST_DEVICE_BINDING,
          now: new Date()
        }),
      InvalidActivationCodeFormat
    );
  });

  it("normalises codes, uses 128-bit nonces, and fresh idempotency keys", () => {
    const prepared = prepareActivation(activationInput(validCode.toLowerCase().replaceAll("-", " ")));
    assert.equal(prepared.body.code, validCode);
    assert.ok(Buffer.from(prepared.body.nonce, "base64url").length >= 16);
    assert.notEqual(prepareActivation(activationInput(validCode)).idempotencyKey, prepared.idempotencyKey);
    assert.equal(prepared.body.client_time, "2026-11-18T09:30:00.000Z");
  });
});

describe("diagnostics", () => {
  it("excludes customer identifiers, device data, and the token", () => {
    const { sources } = clocks(iat + DAY);
    const evaluation = validateInstalledLicense(
      grant(),
      ctx,
      new ClockGuard({ lastTrustedServerTime: iat, highestObservedTime: iat }, sources)
    );
    const text = JSON.stringify(buildDiagnostics(evaluation, null));
    assert.ok(!text.includes(SAMPLE_CLAIMS.customer_id));
    assert.ok(!text.includes(TEST_DEVICE_BINDING));
    assert.ok(!text.includes(TEST_INSTALLATION_ID));
    assert.ok(text.includes(SAMPLE_CLAIMS.license_id));
  });
});
