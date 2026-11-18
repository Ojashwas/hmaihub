#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { issueDevelopmentGrant, loadOrCreateDevKey } from "./index.ts";

const { values } = parseArgs({
  options: {
    "key-dir": { type: "string", default: ".dev-keys" },
    installation: { type: "string" },
    device: { type: "string" },
    products: { type: "string" },
    features: { type: "string" },
    months: { type: "string", default: "6" }
  }
});

if (!values.installation || !values.device) {
  console.error(
    "Usage: hyperoffice-dev-license --installation ins_... --device sha256:... [--products a,b] [--features x,y] [--months 6]"
  );
  process.exit(2);
}

const key = loadOrCreateDevKey(resolve(values["key-dir"]));
const { token, claims } = issueDevelopmentGrant(key, {
  installationId: values.installation,
  deviceBinding: values.device,
  months: Number(values.months),
  ...(values.products ? { products: values.products.split(",") } : {}),
  ...(values.features ? { features: values.features.split(",") } : {})
});
console.error(
  `kid=${key.kid} expires=${new Date(claims.exp * 1000).toISOString()} (development key, not trusted by product builds)`
);
console.log(token);
