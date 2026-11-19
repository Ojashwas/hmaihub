import { PRODUCTS } from "../shared/products.ts";
import { api, type AppInfo } from "./api.ts";
import { el, type Shell } from "./shell.ts";

const GLYPH: Record<string, string> = { hyperdoc: "¶", hypersheet: "▦", hyperdeck: "▭", hyperplan: "▤" };

export function mountLauncher(shell: Shell, info: AppInfo): void {
  shell.toolbar.remove();
  const tiles = info.editors.map((id) => {
    const p = PRODUCTS[id];
    const [r, g, b] = p.color;
    const tile = el(
      "button",
      { type: "button", class: "tile", style: `--tile:rgb(${r} ${g} ${b})`, "aria-label": `Open ${p.name}` },
      el("span", { class: "tile-icon", "aria-hidden": "true", text: GLYPH[id] ?? "" }),
      el("strong", { text: p.name }),
      el("span", { text: p.description })
    );
    tile.addEventListener(
      "click",
      () =>
        void api()
          .openProduct(id)
          .catch((err: unknown) => shell.showError(String(err)))
    );
    return tile;
  });
  shell.content.append(
    el("h1", { text: "Start something new" }),
    el("div", { class: "tiles" }, ...tiles),
    el(
      "p",
      { class: "fine-print" },
      `Version ${info.version} preview. Each app supports a documented subset of its file format and lists anything it cannot keep when you open a file. Licensing is not enforced in preview builds.`
    )
  );
  shell.status.textContent = "Ready";
}
