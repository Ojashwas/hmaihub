import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  assembleCompactJws,
  encodeBase64Url,
  encodeSigningInput,
  evaluateGrant,
  LICENSE_TOKEN_TYPE,
  LicenseTokenError,
  signWithLocalKey,
  trustedKeySetFromJwks,
  verifyCompactJws,
  type GrantValidationContext,
  type ProtectedHeader
} from "../src/index.ts";
import {
  RFC8032_TEST1_PUBLIC_HEX,
  rfc8032PrivateKey,
  SAMPLE_CLAIMS,
  TEST_AUDIENCE,
  TEST_DEVICE_BINDING,
  TEST_EDDSA_KID,
  TEST_EDDSA_PUBLIC_JWK,
  TEST_INSTALLATION_ID,
  TEST_ISSUER
} from "../test-vectors/keys.ts";

interface Vectors {
  keys: unknown[];
  vectors: { id: string; alg: string; deterministic: boolean; token: string }[];
}
const vectors = JSON.parse(readFileSync(new URL("../test-vectors/vectors.json", import.meta.url), "utf8")) as Vectors;
const trustedKeys = trustedKeySetFromJwks(vectors.keys, ["test"]);
const tokenFor = (id: string): string => {
  const v = vectors.vectors.find((x) => x.id === id);
  assert.ok(v, `vector ${id} missing`);
  return v.token;
};
const eddsaToken = tokenFor("eddsa-valid");

const ctx = (overrides: Partial<GrantValidationContext> = {}): GrantValidationContext => ({
  trustedKeys,
  expectedIssuer: TEST_ISSUER,
  expectedAudience: TEST_AUDIENCE,
  product: "hyperdoc",
  installationId: TEST_INSTALLATION_ID,
  deviceBinding: TEST_DEVICE_BINDING,
  now: SAMPLE_CLAIMS.iat + 60,
  ...overrides
});

const b64json = (value: unknown) => encodeBase64Url(Buffer.from(JSON.stringify(value)));
const b64text = (value: string) => encodeBase64Url(Buffer.from(value));
const header: ProtectedHeader = { typ: LICENSE_TOKEN_TYPE, alg: "EdDSA", kid: TEST_EDDSA_KID, ver: 1 };

/** Signs arbitrary raw header/payload segments with the RFC 8032 test key. */
function signRaw(rawHeader: string, rawPayload: string): string {
  const input = `${rawHeader}.${rawPayload}`;
  return assembleCompactJws(input, signWithLocalKey("EdDSA", input, rfc8032PrivateKey()));
}

const expectCode = (fn: () => unknown, code: string) =>
  assert.throws(fn, (err: unknown) => err instanceof LicenseTokenError && err.code === code);

describe("RFC 8032 test key", () => {
  it("derives the published public key and signature for the empty message", () => {
    const pub = createPublicKey(rfc8032PrivateKey()).export({ format: "jwk" });
    assert.equal(Buffer.from(pub.x as string, "base64url").toString("hex"), RFC8032_TEST1_PUBLIC_HEX);
    const sig = sign(null, Buffer.alloc(0), rfc8032PrivateKey()).toString("hex");
    assert.equal(
      sig,
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"
    );
  });
});

describe("test vectors", () => {
  it("EdDSA vector is deterministic and reproducible", () => {
    const input = encodeSigningInput(header, SAMPLE_CLAIMS);
    assert.equal(assembleCompactJws(input, signWithLocalKey("EdDSA", input, rfc8032PrivateKey())), eddsaToken);
  });

  for (const v of vectors.vectors) {
    it(`${v.id} verifies and evaluates as ALLOWED`, () => {
      const result = evaluateGrant(v.token, ctx());
      assert.equal(result.status, "ALLOWED");
      assert.deepEqual(result.claims?.products, SAMPLE_CLAIMS.products);
    });
  }
});

describe("JWS rejection rules", () => {
  const [h, p, s] = eddsaToken.split(".") as [string, string, string];

  it("rejects a modified payload", () => {
    const tampered = b64json({ ...SAMPLE_CLAIMS, exp: SAMPLE_CLAIMS.exp + 86_400 * 365 });
    expectCode(() => verifyCompactJws(`${h}.${tampered}.${s}`, { trustedKeys }), "INVALID_SIGNATURE");
  });

  it("rejects a modified header", () => {
    // Semantically identical header with different bytes must still fail verification.
    const tampered = b64text(JSON.stringify(header, null, 1));
    expectCode(() => verifyCompactJws(`${tampered}.${p}.${s}`, { trustedKeys }), "INVALID_SIGNATURE");
  });

  it("rejects a modified signature", () => {
    const sig = Buffer.from(s, "base64url");
    sig[0] = (sig[0] ?? 0) ^ 0x01;
    expectCode(() => verifyCompactJws(`${h}.${p}.${encodeBase64Url(sig)}`, { trustedKeys }), "INVALID_SIGNATURE");
  });

  it("rejects alg=none with an empty signature", () => {
    expectCode(
      () => verifyCompactJws(`${b64json({ ...header, alg: "none" })}.${p}.`, { trustedKeys }),
      "MALFORMED_TOKEN"
    );
    expectCode(
      () => verifyCompactJws(`${b64json({ ...header, alg: "none" })}.${p}.${s}`, { trustedKeys }),
      "ALGORITHM_NOT_ALLOWED"
    );
  });

  it("rejects algorithms outside the allowlist", () => {
    for (const alg of ["HS256", "RS256", "ES384", "eddsa"]) {
      expectCode(
        () => verifyCompactJws(signRaw(b64json({ ...header, alg }), p), { trustedKeys }),
        "ALGORITHM_NOT_ALLOWED"
      );
    }
  });

  it("rejects algorithm substitution against a trusted key", () => {
    const swapped = signRaw(b64json({ ...header, alg: "ES256" }), p);
    expectCode(() => verifyCompactJws(swapped, { trustedKeys }), "KEY_ALGORITHM_MISMATCH");
  });

  it("rejects an EdDSA token when the build allows only ES256", () => {
    expectCode(
      () => verifyCompactJws(eddsaToken, { trustedKeys, allowedAlgorithms: ["ES256"] }),
      "ALGORITHM_NOT_ALLOWED"
    );
  });

  it("rejects unknown kid", () => {
    expectCode(
      () => verifyCompactJws(signRaw(b64json({ ...header, kid: "unknown-key" }), p), { trustedKeys }),
      "UNKNOWN_KEY_ID"
    );
  });

  it("rejects crit and unknown header parameters", () => {
    expectCode(
      () => verifyCompactJws(signRaw(b64json({ ...header, crit: ["exp"] }), p), { trustedKeys }),
      "UNKNOWN_CRITICAL_HEADER"
    );
    expectCode(
      () => verifyCompactJws(signRaw(b64json({ ...header, jku: "https://attacker.example/keys" }), p), { trustedKeys }),
      "UNSUPPORTED_HEADER_PARAMETER"
    );
  });

  it("rejects wrong typ and unsupported header version", () => {
    expectCode(
      () => verifyCompactJws(signRaw(b64json({ ...header, typ: "JWT" }), p), { trustedKeys }),
      "UNSUPPORTED_TYPE"
    );
    expectCode(
      () => verifyCompactJws(signRaw(b64json({ ...header, ver: 2 }), p), { trustedKeys }),
      "UNSUPPORTED_LICENSE_VERSION"
    );
  });

  it("rejects duplicate JSON members in header and payload", () => {
    const dupHeader = b64text(
      `{"typ":"${LICENSE_TOKEN_TYPE}","alg":"EdDSA","kid":"${TEST_EDDSA_KID}","ver":1,"alg":"EdDSA"}`
    );
    expectCode(() => verifyCompactJws(signRaw(dupHeader, p), { trustedKeys }), "DUPLICATE_JSON_MEMBER");
    const dupPayload = b64text(`{"exp":1,"exp":9999999999}`);
    expectCode(() => verifyCompactJws(signRaw(h, dupPayload), { trustedKeys }), "DUPLICATE_JSON_MEMBER");
  });

  it("rejects malformed JSON and invalid base64url", () => {
    expectCode(() => verifyCompactJws(signRaw(h, b64text("{not json")), { trustedKeys }), "INVALID_JSON");
    expectCode(() => verifyCompactJws(`${h}=.${p}.${s}`, { trustedKeys }), "INVALID_BASE64URL");
    expectCode(() => verifyCompactJws(`${h}.${p}.${s}+`, { trustedKeys }), "INVALID_BASE64URL");
    expectCode(() => verifyCompactJws("a.b", { trustedKeys }), "MALFORMED_TOKEN");
    expectCode(() => verifyCompactJws("x".repeat(20_000), { trustedKeys }), "MALFORMED_TOKEN");
  });

  it("rejects tokens signed by a key that is not trusted", () => {
    const other = generateKeyPairSync("ed25519");
    const input = encodeSigningInput(header, SAMPLE_CLAIMS);
    const forged = assembleCompactJws(input, signWithLocalKey("EdDSA", input, other.privateKey));
    expectCode(() => verifyCompactJws(forged, { trustedKeys }), "INVALID_SIGNATURE");
  });
});

describe("trust store", () => {
  it("refuses private key material", () => {
    assert.throws(() => trustedKeySetFromJwks([{ ...TEST_EDDSA_PUBLIC_JWK, d: "AAAA" }], ["test"]), LicenseTokenError);
  });

  it("refuses keys from environments the build does not trust", () => {
    assert.throws(() => trustedKeySetFromJwks([TEST_EDDSA_PUBLIC_JWK], ["production"]), LicenseTokenError);
  });

  it("treats compromised keys as unusable and retired keys as verify-only", () => {
    const retired = trustedKeySetFromJwks([{ ...TEST_EDDSA_PUBLIC_JWK, status: "retired" }], ["test"]);
    assert.equal(evaluateGrant(eddsaToken, ctx({ trustedKeys: retired })).status, "ALLOWED");
    const compromised = trustedKeySetFromJwks([{ ...TEST_EDDSA_PUBLIC_JWK, status: "compromised" }], ["test"]);
    const result = evaluateGrant(eddsaToken, ctx({ trustedKeys: compromised }));
    assert.equal(result.status, "INVALID_SIGNATURE");
    assert.equal(result.reason, "KEY_NOT_USABLE");
  });
});

describe("grant evaluation", () => {
  it("rejects wrong issuer and audience", () => {
    assert.equal(evaluateGrant(eddsaToken, ctx({ expectedIssuer: "https://evil.example" })).reason, "UNKNOWN_ISSUER");
    assert.equal(evaluateGrant(eddsaToken, ctx({ expectedAudience: "hyperoffice-web" })).reason, "UNKNOWN_AUDIENCE");
  });

  it("rejects the wrong installation or device binding", () => {
    assert.equal(
      evaluateGrant(eddsaToken, ctx({ installationId: "ins_01JOTHERINSTALL01" })).status,
      "WRONG_INSTALLATION"
    );
    assert.equal(
      evaluateGrant(eddsaToken, ctx({ deviceBinding: `sha256:${"A".repeat(43)}` })).status,
      "WRONG_INSTALLATION"
    );
  });

  it("reports an unlicensed product as NOT_ENTITLED", () => {
    assert.equal(evaluateGrant(eddsaToken, ctx({ product: "hyperai" })).status, "NOT_ENTITLED");
  });

  it("applies nbf, exp, and grace boundaries exactly", () => {
    const c = SAMPLE_CLAIMS;
    assert.equal(evaluateGrant(eddsaToken, ctx({ now: c.nbf - 1 })).status, "NOT_YET_VALID");
    assert.equal(evaluateGrant(eddsaToken, ctx({ now: c.nbf })).status, "ALLOWED");
    assert.equal(evaluateGrant(eddsaToken, ctx({ now: c.exp - 1 })).status, "ALLOWED");
    assert.equal(evaluateGrant(eddsaToken, ctx({ now: c.exp })).status, "GRACE_PERIOD");
    assert.equal(evaluateGrant(eddsaToken, ctx({ now: c.grace_until - 1 })).status, "GRACE_PERIOD");
    assert.equal(evaluateGrant(eddsaToken, ctx({ now: c.grace_until })).status, "EXPIRED");
  });

  it("rejects unknown claims, malformed timestamps, and unsupported policy versions", () => {
    const signClaims = (claims: object) => {
      const input = encodeSigningInput(header, claims);
      return assembleCompactJws(input, signWithLocalKey("EdDSA", input, rfc8032PrivateKey()));
    };
    assert.equal(evaluateGrant(signClaims({ ...SAMPLE_CLAIMS, admin: true }), ctx()).reason, "INVALID_CLAIMS");
    assert.equal(evaluateGrant(signClaims({ ...SAMPLE_CLAIMS, exp: "2027-01-01" }), ctx()).reason, "INVALID_CLAIMS");
    assert.equal(evaluateGrant(signClaims({ ...SAMPLE_CLAIMS, exp: 1.5e9 + 0.5 }), ctx()).reason, "INVALID_CLAIMS");
    assert.equal(
      evaluateGrant(signClaims({ ...SAMPLE_CLAIMS, exp: SAMPLE_CLAIMS.nbf }), ctx()).reason,
      "INVALID_CLAIMS"
    );
    assert.equal(
      evaluateGrant(signClaims({ ...SAMPLE_CLAIMS, policy_version: 2 }), ctx()).status,
      "UNSUPPORTED_LICENSE_VERSION"
    );
  });
});
