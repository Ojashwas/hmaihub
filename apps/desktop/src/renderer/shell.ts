import type { AnyModel } from "@hyperoffice/office-formats/models";
import { PRODUCTS, type ProductId } from "../shared/products.ts";
import { api, type OpenResult } from "./api.ts";

type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  node.append(...children);
  return node;
}

export function button(label: string, title: string, onClick: () => void, extra: Attrs = {}): HTMLButtonElement {
  const b = el("button", { type: "button", title, "aria-label": title, ...extra }, label);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", onClick);
  return b;
}

export const separator = () => el("span", { class: "sep", "aria-hidden": "true" });

export interface Shell {
  toolbar: HTMLElement;
  content: HTMLElement;
  status: HTMLElement;
  showWarnings(fileName: string, warnings: string[]): void;
  showError(message: string): void;
  clearMessages(): void;
}

export function mountShell(product: ProductId): Shell {
  const info = PRODUCTS[product];
  const [r, g, b] = info.color;
  document.documentElement.style.setProperty("--accent", `rgb(${r} ${g} ${b})`);
  document.title = info.name;

  const toolbar = el("div", { class: "toolbar", role: "toolbar", "aria-label": `${info.name} toolbar` });
  const messages = el("div", { class: "messages", "aria-live": "polite" });
  const content = el("main", { class: `content content-${product}` });
  const status = el("footer", { class: "status" });
  const header = el(
    "header",
    { class: "appbar" },
    el("span", { class: "brand" }, el("span", { class: "logo", "aria-hidden": "true" }), info.name),
    el("span", { class: "preview-tag", text: "Preview build" })
  );
  document.body.replaceChildren(header, toolbar, messages, content, status);

  const message = (kind: string, title: string, detail?: string[]) => {
    const box = el(
      "div",
      { class: `message message-${kind}`, role: kind === "error" ? "alert" : "status" },
      el("strong", { text: title })
    );
    if (detail?.length) box.append(el("ul", {}, ...detail.map((d) => el("li", { text: d }))));
    box.append(button("✕", "Dismiss", () => box.remove(), { class: "dismiss" }));
    messages.append(box);
  };

  return {
    toolbar,
    content,
    status,
    showWarnings: (fileName, warnings) => {
      if (warnings.length) message("warning", `${fileName} contains content this preview cannot keep:`, warnings);
    },
    showError: (m) => message("error", m),
    clearMessages: () => messages.replaceChildren()
  };
}

export interface EditorHooks<T extends AnyModel> {
  newModel(): T;
  getModel(): T;
  setModel(model: T): void;
}

const cleanError = (err: unknown) =>
  String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

let exposeTestHooks = false;
/** Smoke-test builds expose editor hooks so the main process can verify model round-trips. */
export const enableTestHooks = () => {
  exposeTestHooks = true;
};

/** Wires New/Open/Save/Save As buttons, menu commands, and dirty tracking for an editor. */
export function wireDocumentCommands<T extends AnyModel>(shell: Shell, hooks: EditorHooks<T>): { markDirty(): void } {
  if (exposeTestHooks) (window as unknown as { __hyperofficeTest: EditorHooks<T> }).__hyperofficeTest = hooks;
  let dirty = false;
  const setDirty = (d: boolean) => {
    if (d !== dirty) {
      dirty = d;
      api().setDirty(d);
    }
  };

  const applyOpened = (result: OpenResult) => {
    shell.clearMessages();
    hooks.setModel(result.model as T);
    shell.showWarnings(result.name, result.warnings);
    setDirty(false);
  };

  const commands: Record<string, () => Promise<void> | void> = {
    new: () => {
      if (dirty && !confirm("Discard unsaved changes?")) return;
      shell.clearMessages();
      hooks.setModel(hooks.newModel());
      setDirty(false);
    },
    open: async () => {
      if (dirty && !confirm("Discard unsaved changes?")) return;
      const result = await api().open();
      if (result) applyOpened(result);
    },
    save: async () => {
      if (await api().save(hooks.getModel(), false)) setDirty(false);
    },
    saveAs: async () => {
      if (await api().save(hooks.getModel(), true)) setDirty(false);
    }
  };
  const run = (name: string) => {
    Promise.resolve(commands[name]?.()).catch((err: unknown) => shell.showError(cleanError(err)));
  };

  shell.toolbar.append(
    button("New", "New (Ctrl+N)", () => run("new")),
    button("Open", "Open (Ctrl+O)", () => run("open")),
    button("Save", "Save (Ctrl+S)", () => run("save")),
    button("Save as", "Save as (Ctrl+Shift+S)", () => run("saveAs")),
    separator()
  );
  api().onMenu(run);
  api().onOpened(applyOpened);
  return { markDirty: () => setDirty(true) };
}
