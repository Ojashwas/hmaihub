// Bundles main, preload, and renderer into dist/ and generates product icons into build/icons/.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { PRODUCTS, type ProductId } from "@hyperoffice/app-shell/products";
import { productIcon } from "./icons.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "renderer"), { recursive: true });

const common = { bundle: true, legalComments: "eof", logLevel: "warning", minify: false } as const;

await build({
  ...common,
  entryPoints: [join(root, "src/main/main.ts")],
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  outfile: join(dist, "main.cjs")
});
await build({
  ...common,
  entryPoints: [join(root, "src/preload/preload.ts")],
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  outfile: join(dist, "preload.cjs")
});
await build({
  ...common,
  entryPoints: [join(root, "src/renderer/app.ts")],
  platform: "browser",
  format: "iife",
  target: "chrome130",
  outfile: join(dist, "renderer/app.js")
});
// Each app imports its own stylesheet; esbuild emits them together as renderer/app.css.
copyFileSync(join(root, "src/renderer/index.html"), join(dist, "renderer/index.html"));

const icons = join(root, "build/icons");
mkdirSync(icons, { recursive: true });
for (const id of Object.keys(PRODUCTS) as ProductId[])
  writeFileSync(join(icons, `${id}.png`), productIcon(id, PRODUCTS[id].color));

console.log(`built ${dist}`);
