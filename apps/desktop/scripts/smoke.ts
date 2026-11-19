// Launches every product window headlessly and fails on renderer errors or a missing ready signal.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import electronPath from "electron";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env: NodeJS.ProcessEnv = { ...process.env, HYPEROFFICE_SMOKE_TEST: "1", ELECTRON_ENABLE_LOGGING: "0" };
delete env["NODE_OPTIONS"];
const result = spawnSync(electronPath as unknown as string, [root], {
  env,
  encoding: "utf8",
  timeout: 60_000
});
const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const line = out.split(/\r?\n/).find((l) => l.startsWith("SMOKE"));
console.log(line ?? out.slice(-2000));
process.exit(result.status === 0 && line?.startsWith("SMOKE OK") ? 0 : 1);
