// Regenerates vectors.json. Run: node packages/licensing-core/test-vectors/generate.ts
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { assembleCompactJws, encodeSigningInput, LICENSE_TOKEN_TYPE, signWithLocalKey } from "../src/jws.ts";
import { rfc8032PrivateKey, SAMPLE_CLAIMS, TEST_EDDSA_KID, TEST_EDDSA_PUBLIC_JWK } from "./keys.ts";

const eddsaInput = encodeSigningInput(
  { typ: LICENSE_TOKEN_TYPE, alg: "EdDSA", kid: TEST_EDDSA_KID, ver: 1 },
  SAMPLE_CLAIMS
);
const eddsaToken = assembleCompactJws(eddsaInput, signWithLocalKey("EdDSA", eddsaInput, rfc8032PrivateKey()));

// ES256 signatures are randomised; only the public key and one signed token are kept.
const es = generateKeyPairSync("ec", { namedCurve: "P-256" });
const esKid = "ho-license-test-es256-1";
const esJwk = es.publicKey.export({ format: "jwk" });
const esInput = encodeSigningInput({ typ: LICENSE_TOKEN_TYPE, alg: "ES256", kid: esKid, ver: 1 }, SAMPLE_CLAIMS);
const esToken = assembleCompactJws(esInput, signWithLocalKey("ES256", esInput, es.privateKey));

const vectors = {
  description: "HyperOffice licence-grant test vectors. Test-environment keys only; never trusted by product builds.",
  claims: SAMPLE_CLAIMS,
  keys: [
    TEST_EDDSA_PUBLIC_JWK,
    { ...esJwk, kid: esKid, alg: "ES256", use: "sig", status: "active", environment: "test" }
  ],
  vectors: [
    { id: "eddsa-valid", alg: "EdDSA", deterministic: true, token: eddsaToken },
    { id: "es256-valid", alg: "ES256", deterministic: false, token: esToken }
  ]
};

writeFileSync(new URL("./vectors.json", import.meta.url), `${JSON.stringify(vectors, null, 2)}\n`);
console.log("wrote vectors.json");
