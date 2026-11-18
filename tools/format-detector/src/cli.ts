#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { DESKTOP_LIMITS, detectFormat, PackageSecurityError } from "./index.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: hyperoffice-detect <file>");
  process.exit(2);
}
if (statSync(file).size > DESKTOP_LIMITS.maxTotalUncompressed) {
  console.error("File exceeds the desktop size limit");
  process.exit(1);
}
try {
  const result = detectFormat(readFileSync(file), { fileName: basename(file) });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  if (err instanceof PackageSecurityError) {
    console.log(JSON.stringify({ rejected: true, code: err.code, message: err.message }, null, 2));
    process.exit(1);
  }
  throw err;
}
