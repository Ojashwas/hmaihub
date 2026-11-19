import type { Alignment, DocumentModel, Paragraph, ParagraphStyle, TextRun } from "@hyperoffice/office-formats/models";
import { button, el, separator, wireDocumentCommands, type Shell } from "@hyperoffice/app-shell";
import { pushRun, type Fmt } from "../document/runs.ts";
import "../styles/hyperdoc.css";

const STYLE_TAG: Record<ParagraphStyle, string> = { Normal: "p", Title: "h1", Heading1: "h2", Heading2: "h3" };
const TAG_STYLE: Record<string, ParagraphStyle> = { P: "Normal", H1: "Title", H2: "Heading1", H3: "Heading2" };
const BLOCKS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "LI", "BLOCKQUOTE", "PRE"]);
const ALIGN_CSS: Record<Alignment, string> = { left: "", center: "center", right: "right", both: "justify" };

function paragraphToBlock(p: Paragraph): HTMLElement {
  const block = document.createElement(STYLE_TAG[p.style]);
  if (p.rtl) block.dir = "rtl";
  if (p.align) block.style.textAlign = ALIGN_CSS[p.align];
  for (const run of p.runs) {
    let node: Node = document.createDocumentFragment();
    const parts = run.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) node.appendChild(document.createElement("br"));
      if (part) node.appendChild(document.createTextNode(part));
    });
    if (run.underline) node = wrap("u", node);
    if (run.italic) node = wrap("i", node);
    if (run.bold) node = wrap("b", node);
    block.appendChild(node);
  }
  if (!block.textContent) block.appendChild(document.createElement("br"));
  return block;
}

function wrap(tag: string, child: Node): HTMLElement {
  const w = document.createElement(tag);
  w.appendChild(child);
  return w;
}

function formatOf(node: HTMLElement, parent: Fmt): Fmt {
  const fmt = { ...parent };
  const t = node.tagName;
  const s = node.style;
  if (t === "B" || t === "STRONG" || s.fontWeight === "bold" || Number(s.fontWeight) >= 600) fmt.bold = true;
  if (t === "I" || t === "EM" || s.fontStyle === "italic") fmt.italic = true;
  if (t === "U" || s.textDecoration.includes("underline") || s.textDecorationLine.includes("underline"))
    fmt.underline = true;
  return fmt;
}

function collectRuns(node: Node, fmt: Fmt, runs: TextRun[], block: HTMLElement): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      pushRun(runs, child.textContent ?? "", fmt);
    } else if (child instanceof HTMLElement) {
      if (child.tagName === "BR") {
        if (child !== block.lastChild) pushRun(runs, "\n", fmt);
      } else collectRuns(child, formatOf(child, fmt), runs, block);
    }
  }
}

function blockToParagraph(block: HTMLElement): Paragraph {
  const runs: TextRun[] = [];
  collectRuns(block, formatOf(block, {}), runs, block);
  const p: Paragraph = { style: TAG_STYLE[block.tagName] ?? "Normal", runs };
  const align = block.style.textAlign;
  if (align === "center" || align === "right") p.align = align;
  else if (align === "justify") p.align = "both";
  if (block.dir === "rtl") p.rtl = true;
  return p;
}

export function extractParagraphs(page: HTMLElement): Paragraph[] {
  const out: Paragraph[] = [];
  let loose: HTMLElement | null = null;
  const visit = (container: HTMLElement) => {
    for (const child of Array.from(container.childNodes)) {
      if (child instanceof HTMLElement && BLOCKS.has(child.tagName)) {
        loose = null;
        if (Array.from(child.children).some((c) => BLOCKS.has(c.tagName))) visit(child);
        else out.push(blockToParagraph(child));
      } else {
        if (!loose) {
          loose = document.createElement("p");
          out.push({ style: "Normal", runs: [] });
        }
        loose.appendChild(child.cloneNode(true));
        out[out.length - 1] = blockToParagraph(loose);
      }
    }
  };
  visit(page);
  return out.length ? out : [{ style: "Normal", runs: [] }];
}

function currentBlock(page: HTMLElement): HTMLElement | null {
  let n: Node | null = document.getSelection()?.anchorNode ?? null;
  while (n && n !== page) {
    if (n instanceof HTMLElement && BLOCKS.has(n.tagName) && n.parentElement === page) return n;
    n = n.parentNode;
  }
  return null;
}

export function mountDoc(shell: Shell): void {
  const page = el("div", {
    class: "doc-page",
    contenteditable: "true",
    spellcheck: "true",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "Document"
  });
  shell.content.append(el("div", { class: "doc-scroller" }, page));
  const words = el("span");
  shell.status.append(words);

  const newModel = (): DocumentModel => ({ kind: "document", paragraphs: [{ style: "Normal", runs: [] }] });
  const setModel = (m: DocumentModel) => {
    page.replaceChildren(...m.paragraphs.map(paragraphToBlock));
    updateStatus();
  };
  const { markDirty } = wireDocumentCommands<DocumentModel>(shell, {
    newModel,
    getModel: () => ({ kind: "document", paragraphs: extractParagraphs(page) }),
    setModel
  });

  const styleSelect = el(
    "select",
    { title: "Paragraph style", "aria-label": "Paragraph style" },
    el("option", { value: "p", text: "Normal" }),
    el("option", { value: "h1", text: "Title" }),
    el("option", { value: "h2", text: "Heading 1" }),
    el("option", { value: "h3", text: "Heading 2" })
  );
  styleSelect.addEventListener("change", () => {
    page.focus();
    document.execCommand("formatBlock", false, styleSelect.value);
    markDirty();
  });
  const exec = (cmd: string) => () => {
    document.execCommand(cmd);
    markDirty();
  };
  const toggleDir = () => {
    const block = currentBlock(page);
    if (!block) return;
    block.dir = block.dir === "rtl" ? "ltr" : "rtl";
    if (block.dir === "ltr") block.removeAttribute("dir");
    markDirty();
  };
  shell.toolbar.append(
    styleSelect,
    separator(),
    button("B", "Bold (Ctrl+B)", exec("bold"), { class: "fmt-b" }),
    button("I", "Italic (Ctrl+I)", exec("italic"), { class: "fmt-i" }),
    button("U", "Underline (Ctrl+U)", exec("underline"), { class: "fmt-u" }),
    separator(),
    button("⯇", "Align left", exec("justifyLeft")),
    button("≡", "Center", exec("justifyCenter")),
    button("⯈", "Align right", exec("justifyRight")),
    button("☰", "Justify", exec("justifyFull")),
    separator(),
    button("⇄ RTL", "Toggle right-to-left paragraph", toggleDir)
  );

  page.addEventListener("input", () => {
    markDirty();
    updateStatus();
  });
  page.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
  });
  document.addEventListener("selectionchange", () => {
    const block = currentBlock(page);
    if (block)
      styleSelect.value =
        block.tagName.toLowerCase() in { p: 1, h1: 1, h2: 1, h3: 1 } ? block.tagName.toLowerCase() : "p";
  });

  function updateStatus() {
    const text = page.innerText.trim();
    words.textContent = `${text ? text.split(/\s+/).length : 0} words · ${page.children.length} paragraphs`;
  }

  document.execCommand("styleWithCSS", false, "false");
  setModel(newModel());
  page.focus();
}
