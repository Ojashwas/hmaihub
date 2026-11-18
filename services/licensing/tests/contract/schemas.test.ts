import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { decodeBase64UrlStrict } from "@hyperoffice/licensing-core";
import { activateLicense } from "../../src/index.ts";
import { activationBody, installation, issueOne, key, NOW, setup } from "../helpers.ts";

const dir = new URL("../../../../schemas/licensing/", import.meta.url);
const ajv = new Ajv2020({ allErrors: true, strict: true });
for (const file of readdirSync(dir))
  ajv.addSchema(JSON.parse(readFileSync(new URL(file, dir), "utf8")) as object, file);
const validator = (name: string) => {
  const v = ajv.getSchema(name);
  assert.ok(v, `${name} not loaded`);
  return v;
};

describe("licensing JSON Schemas match the implementation", () => {
  it("all schemas compile in strict mode", () => {
    for (const file of readdirSync(dir)) validator(file);
  });

  it("a real activation request, response, grant payload, and key set validate", async () => {
    const { deps, signer } = await setup();
    const body = activationBody(await issueOne(deps, "tpl_PRO6M"), installation());
    const res = await activateLicense(deps, { body, idempotencyKey: key(), sourceIp: "198.51.100.1", now: NOW });

    const check = (name: string, value: unknown) => {
      const v = validator(name);
      assert.ok(v(value), `${name}: ${JSON.stringify(v.errors)}`);
    };
    check("activation-request.schema.json", body);
    check("activation-response.schema.json", res);
    const payload = JSON.parse(
      Buffer.from(decodeBase64UrlStrict(res.license_grant.split(".")[1] as string)).toString("utf8")
    );
    check("license-grant.schema.json", payload);
    check("public-key-set.schema.json", { keys: [signer.publicJwk("active")] });
  });

  it("the grant schema rejects unknown claims and the key-set schema rejects private keys", async () => {
    const { deps, signer } = await setup();
    const res = await activateLicense(deps, {
      body: activationBody(await issueOne(deps, "tpl_PRO6M"), installation()),
      idempotencyKey: key(),
      sourceIp: "198.51.100.1",
      now: NOW
    });
    const payload = JSON.parse(
      Buffer.from(decodeBase64UrlStrict(res.license_grant.split(".")[1] as string)).toString("utf8")
    );
    assert.equal(validator("license-grant.schema.json")({ ...payload, admin: true }), false);
    assert.equal(
      validator("public-key-set.schema.json")({ keys: [{ ...signer.publicJwk("active"), d: "secret" }] }),
      false
    );
  });
});
