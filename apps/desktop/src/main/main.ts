import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from "electron";
import { loadFile, saveFile, type LoadResult, type ModelKind } from "@hyperoffice/office-formats";
import { EDITORS, editorForExtension, isProductId, PRODUCTS, type ProductId } from "@hyperoffice/app-shell/products";
import { canonicalJson, SMOKE_MODELS } from "./smoke-models.ts";
import { validateModel } from "./validate.ts";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const SMOKE = process.env["HYPEROFFICE_SMOKE_TEST"] === "1";

interface WindowState {
  product: ProductId;
  filePath?: string;
  lossy: boolean;
  dirty: boolean;
}
const windows = new Map<number, WindowState>();

function packagedProduct(): ProductId {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), "package.json"), "utf8")) as {
      hyperoffice?: { product?: unknown };
    };
    if (isProductId(pkg.hyperoffice?.product)) return pkg.hyperoffice.product;
  } catch {
    // fall through to environment/default
  }
  const fromArg = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);
  const fromEnv = process.env["HYPEROFFICE_PRODUCT"];
  return isProductId(fromArg) ? fromArg : isProductId(fromEnv) ? fromEnv : "suite";
}

const APP_PRODUCT = packagedProduct();
app.setName(PRODUCTS[APP_PRODUCT].name);
if (process.platform === "win32") app.setAppUserModelId(PRODUCTS[APP_PRODUCT].appId);

function stateFor(event: IpcMainInvokeEvent | Electron.IpcMainEvent): { win: BrowserWindow; state: WindowState } {
  const win = BrowserWindow.fromWebContents(event.sender);
  const state = windows.get(event.sender.id);
  if (!win || !state) throw new Error("Unknown window");
  return { win, state };
}

function kindOf(state: WindowState): ModelKind {
  const kind = PRODUCTS[state.product].kind;
  if (!kind) throw new Error("The launcher has no document");
  return kind;
}

function readDocument(path: string, kind: ModelKind): LoadResult {
  const size = statSync(path).size;
  if (size > MAX_FILE_BYTES) throw new Error("The file is larger than 200 MB");
  return loadFile(new Uint8Array(readFileSync(path)), kind, basename(path));
}

function writeAtomically(path: string, bytes: Uint8Array): void {
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(temp, bytes, { flag: "wx" });
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}

function createWindow(product: ProductId, fileToOpen?: string): BrowserWindow {
  const info = PRODUCTS[product];
  const win = new BrowserWindow({
    width: product === "suite" ? 980 : 1320,
    height: product === "suite" ? 680 : 860,
    minWidth: 720,
    minHeight: 480,
    title: info.name,
    show: false,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true
    }
  });
  const id = win.webContents.id;
  windows.set(id, { product, lossy: false, dirty: false });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    const state = windows.get(id);
    if (!SMOKE && state?.dirty) {
      const choice = dialog.showMessageBoxSync(win, {
        type: "warning",
        buttons: ["Discard changes", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: "You have unsaved changes.",
        detail: "Close this window and discard them?"
      });
      if (choice === 1) e.preventDefault();
    }
  });
  win.on("closed", () => windows.delete(id));
  win.once("ready-to-show", () => {
    if (!SMOKE) win.show();
  });
  void win.loadFile(join(__dirname, "renderer", "index.html"), { query: { product } });
  if (fileToOpen) {
    win.webContents.once("did-finish-load", () => {
      const state = windows.get(id);
      if (!state) return;
      try {
        const result = readDocument(fileToOpen, kindOf(state));
        state.filePath = fileToOpen;
        state.lossy = result.warnings.length > 0;
        win.webContents.send("ho:opened", { name: basename(fileToOpen), ...result });
      } catch (err) {
        dialog.showErrorBox("Cannot open file", (err as Error).message);
      }
    });
  }
  return win;
}

function fileFromArgv(argv: string[]): { path: string; product: ProductId } | undefined {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith("-")) continue;
    const editor = editorForExtension(extname(arg));
    if (!editor || !existsSync(arg)) continue;
    if (APP_PRODUCT === "suite" || APP_PRODUCT === editor) return { path: arg, product: editor };
  }
  return undefined;
}

function registerIpc(): void {
  ipcMain.handle("ho:info", (event) => {
    const { state } = stateFor(event);
    return {
      product: state.product,
      appProduct: APP_PRODUCT,
      version: app.getVersion(),
      editors: APP_PRODUCT === "suite" ? EDITORS : [],
      smoke: SMOKE
    };
  });

  ipcMain.handle("ho:open", async (event) => {
    const { win, state } = stateFor(event);
    const info = PRODUCTS[state.product];
    const kind = kindOf(state);
    const res = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: info.fileTypeName ?? "Documents", extensions: info.openExtensions }]
    });
    const path = res.filePaths[0];
    if (res.canceled || !path) return null;
    const result = readDocument(path, kind);
    state.filePath = path;
    state.lossy = result.warnings.length > 0;
    state.dirty = false;
    win.setTitle(`${basename(path)} - ${info.name}`);
    return { name: basename(path), ...result };
  });

  ipcMain.handle("ho:save", async (event, model: unknown, saveAs: unknown) => {
    const { win, state } = stateFor(event);
    const info = PRODUCTS[state.product];
    const kind = kindOf(state);
    const valid = validateModel(model, kind);
    const ext = info.saveExtension as string;
    let path = saveAs === true ? undefined : state.filePath;
    if (path && extname(path).toLowerCase() !== `.${ext}`) path = undefined;
    if (path && state.lossy) {
      const choice = dialog.showMessageBoxSync(win, {
        type: "warning",
        buttons: ["Save as a new file", "Overwrite original", "Cancel"],
        defaultId: 0,
        cancelId: 2,
        message: `${info.name} cannot keep some content from the original file.`,
        detail: "Overwriting would permanently remove that content. Save a copy instead?"
      });
      if (choice === 2) return null;
      if (choice === 0) path = undefined;
    }
    if (!path) {
      const base = state.filePath ? basename(state.filePath, extname(state.filePath)) : "Untitled";
      const res = await dialog.showSaveDialog(win, {
        defaultPath: join(state.filePath ? dirname(state.filePath) : app.getPath("documents"), `${base}.${ext}`),
        filters: [{ name: info.fileTypeName ?? "Document", extensions: [ext] }]
      });
      if (res.canceled || !res.filePath) return null;
      path = res.filePath;
    }
    writeAtomically(path, saveFile(valid));
    state.filePath = path;
    state.lossy = false;
    state.dirty = false;
    win.setTitle(`${basename(path)} - ${info.name}`);
    return { name: basename(path) };
  });

  ipcMain.handle("ho:new-window", (event, product: unknown) => {
    const { state } = stateFor(event);
    if (state.product !== "suite" || !isProductId(product) || product === "suite") throw new Error("Not allowed");
    createWindow(product);
  });

  ipcMain.on("ho:dirty", (event, dirty: unknown) => {
    const state = windows.get(event.sender.id);
    if (state) state.dirty = dirty === true;
  });
}

function buildMenu(): void {
  const send = (cmd: string) => () => BrowserWindow.getFocusedWindow()?.webContents.send("ho:menu", cmd);
  const template: MenuItemConstructorOptions[] = [
    {
      label: "&File",
      submenu: [
        { label: "&New", accelerator: "CmdOrCtrl+N", click: send("new") },
        { label: "&Open…", accelerator: "CmdOrCtrl+O", click: send("open") },
        { label: "&Save", accelerator: "CmdOrCtrl+S", click: send("save") },
        { label: "Save &As…", accelerator: "CmdOrCtrl+Shift+S", click: send("saveAs") },
        { type: "separator" },
        { role: "close" },
        { role: "quit" }
      ]
    },
    { role: "editMenu" },
    {
      label: "&View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(app.isPackaged ? [] : ([{ role: "toggleDevTools" }] as MenuItemConstructorOptions[]))
      ]
    },
    {
      label: "&Help",
      submenu: [
        {
          label: `About ${PRODUCTS[APP_PRODUCT].name}`,
          click: () =>
            void dialog.showMessageBox({
              title: PRODUCTS[APP_PRODUCT].name,
              message: `${PRODUCTS[APP_PRODUCT].name} ${app.getVersion()} (preview)`,
              detail:
                "Preview build. Supports a subset of each file format; unsupported content is reported when a file is opened.\nLicensing is not enforced in preview builds."
            })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function runSmokeTest(): void {
  const products: ProductId[] = ["suite", ...EDITORS];
  const pending = new Set(products);
  const failures: string[] = [];
  const byProduct = new Map<ProductId, BrowserWindow>();

  const roundTrips = async () => {
    for (const id of EDITORS) {
      const win = byProduct.get(id) as BrowserWindow;
      const expected = canonicalJson(SMOKE_MODELS[id]);
      const viaEditor = (await win.webContents.executeJavaScript(
        `__hyperofficeTest.setModel(${JSON.stringify(SMOKE_MODELS[id])}); JSON.stringify(__hyperofficeTest.getModel())`
      )) as string;
      if (canonicalJson(JSON.parse(viaEditor)) !== expected)
        failures.push(`${id}: editor round-trip changed the model\n  ${viaEditor}`);
      const kind = PRODUCTS[id].kind as ModelKind;
      const viaFile = loadFile(saveFile(validateModel(JSON.parse(viaEditor), kind)), kind).model;
      if (canonicalJson(viaFile) !== expected)
        failures.push(`${id}: file round-trip changed the model\n  ${JSON.stringify(viaFile)}`);
    }
  };

  ipcMain.on("ho:ready", (event) => {
    const state = windows.get(event.sender.id);
    if (state) pending.delete(state.product);
    if (pending.size > 0) return;
    roundTrips()
      .catch((err: unknown) => failures.push(`round-trip error: ${String(err)}`))
      .finally(() => {
        console.log(
          failures.length
            ? `SMOKE FAIL\n${failures.join("\n")}`
            : `SMOKE OK: ${products.join(", ")}; editor and file round-trips passed`
        );
        app.exit(failures.length ? 1 : 0);
      });
  });
  for (const p of products) {
    const win = createWindow(p);
    byProduct.set(p, win);
    win.webContents.on("console-message", (details) => {
      if (details.level === "error") failures.push(`${p}: ${details.message}`);
    });
    win.webContents.on("render-process-gone", (_e, d) => failures.push(`${p}: renderer gone (${d.reason})`));
  }
  setTimeout(() => {
    console.log(`SMOKE TIMEOUT: no ready signal from ${[...pending].join(", ")}\n${failures.join("\n")}`);
    app.exit(2);
  }, 30_000);
}

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const file = fileFromArgv(argv);
    if (file) createWindow(file.product, file.path);
    else BrowserWindow.getAllWindows()[0]?.focus();
  });

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(permission === "fullscreen")
    );
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith("file://") && !details.url.startsWith("devtools://") });
    });
    registerIpc();
    buildMenu();
    if (SMOKE) return runSmokeTest();
    const file = fileFromArgv(process.argv);
    createWindow(file?.product ?? APP_PRODUCT, file?.path);
  });

  app.on("window-all-closed", () => app.quit());
}
