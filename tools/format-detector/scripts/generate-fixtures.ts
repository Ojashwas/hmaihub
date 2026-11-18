// Regenerates compatibility/fixtures from src/fixtures.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MINIMAL_MSPDI, MINIMAL_PACKAGES, writeZip } from "../src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../compatibility/fixtures");
for (const [path, entries] of Object.entries(MINIMAL_PACKAGES)) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, writeZip(entries));
  console.log(`wrote ${path}`);
}
mkdirSync(join(root, "project"), { recursive: true });
writeFileSync(join(root, "project/minimal-mspdi.xml"), MINIMAL_MSPDI);
console.log("wrote project/minimal-mspdi.xml");
