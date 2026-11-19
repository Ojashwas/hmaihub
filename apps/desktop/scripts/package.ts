// Packages one Windows installer per product with electron-builder.
// Final installers are copied to <repo>/exe (or $HYPEROFFICE_EXE_DIR); intermediates stay in
// $HYPEROFFICE_RELEASE_DIR or ~/HyperOffice-release, outside synced folders.
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Arch, build, Platform } from "electron-builder";
import { PRODUCTS, type ProductId } from "@hyperoffice/app-shell/products";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version: string;
  devDependencies: Record<string, string>;
};
const electronVersion = pkg.devDependencies["electron"] as string;
const releaseDir = process.env["HYPEROFFICE_RELEASE_DIR"] ?? join(homedir(), "HyperOffice-release");
const exeDir = process.env["HYPEROFFICE_EXE_DIR"] ?? join(root, "../../exe");
const only = process.argv.slice(2).filter((a) => !a.startsWith("-")) as ProductId[];
const products = (only.length ? only : (Object.keys(PRODUCTS) as ProductId[])).filter((p) => p in PRODUCTS);

mkdirSync(releaseDir, { recursive: true });
mkdirSync(exeDir, { recursive: true });
const artifacts: string[] = [];

for (const id of products) {
  const info = PRODUCTS[id];
  const stage = join(root, ".stage", id);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "build"), { recursive: true });
  cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });
  cpSync(join(root, "build/icons", `${id}.png`), join(stage, "build/icon.png"));
  writeFileSync(
    join(stage, "package.json"),
    JSON.stringify(
      {
        name: `hyperoffice-${id}`,
        productName: info.name,
        version: pkg.version,
        description: info.description,
        author: "HyperOffice",
        license: "UNLICENSED",
        main: "dist/main.cjs",
        hyperoffice: { product: id }
      },
      null,
      2
    )
  );

  const output = join(releaseDir, id);
  rmSync(output, { recursive: true, force: true });
  const files = await build({
    projectDir: stage,
    targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
    config: {
      appId: info.appId,
      productName: info.name,
      copyright: "Copyright © 2026 HyperOffice",
      electronVersion,
      asar: true,
      npmRebuild: false,
      nodeGypRebuild: false,
      directories: { output, buildResources: "build" },
      files: ["dist/**", "package.json"],
      win: { icon: "build/icon.png", target: [{ target: "nsis", arch: ["x64"] }] },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: info.name,
        artifactName: `${info.name}-Setup-${pkg.version}.exe`,
        uninstallDisplayName: info.name
      },
      fileAssociations:
        id === "suite" || id === "hyperplan" || !info.fileTypeName
          ? []
          : [{ ext: info.openExtensions, name: info.fileTypeName, description: info.fileTypeName, role: "Editor" }]
    }
  });
  for (const f of files) {
    if (!f.endsWith(".exe")) continue;
    const target = join(exeDir, basename(f));
    copyFileSync(f, target);
    artifacts.push(target);
  }
  for (const entry of readdirSync(output))
    if (entry.endsWith("-unpacked")) rmSync(join(output, entry), { recursive: true, force: true });
}

console.log(`\nInstallers:\n${artifacts.map((a) => `  ${a}`).join("\n")}`);
