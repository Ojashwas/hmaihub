import type { PresentationModel, SlideModel } from "@hyperoffice/office-formats/models";
import { button, el, separator, wireDocumentCommands, type Shell } from "./shell.ts";

export function mountDeck(shell: Shell): void {
  let model: PresentationModel = newModel();
  let current = 0;

  const list = el("ol", { class: "slide-list", "aria-label": "Slides" });
  const title = el("div", {
    class: "slide-title",
    contenteditable: "plaintext-only",
    role: "textbox",
    "aria-label": "Slide title",
    "data-placeholder": "Click to add title"
  });
  const body = el("ul", {
    class: "slide-body",
    contenteditable: "true",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "Slide content",
    "data-placeholder": "Click to add text"
  });
  const stage = el("div", { class: "slide" }, title, body);
  shell.content.append(el("aside", { class: "slide-rail" }, list), el("div", { class: "stage" }, stage));
  const counter = el("span");
  shell.status.append(counter);

  function newModel(): PresentationModel {
    return { kind: "presentation", slides: [{ title: "", bullets: [] }] };
  }
  const slide = () => model.slides[current] as SlideModel;

  const { markDirty } = wireDocumentCommands<PresentationModel>(shell, {
    newModel,
    getModel: () => {
      syncFromEditor();
      return model;
    },
    setModel: (m) => {
      model = m.slides.length ? m : newModel();
      current = 0;
      renderAll();
    }
  });

  const edit = (fn: () => void) => () => {
    syncFromEditor();
    fn();
    markDirty();
    renderAll();
  };
  shell.toolbar.append(
    button(
      "+ Slide",
      "New slide",
      edit(() => model.slides.splice(++current, 0, { title: "", bullets: [] }))
    ),
    button(
      "Duplicate",
      "Duplicate slide",
      edit(() => model.slides.splice(++current, 0, structuredClone(slide())))
    ),
    button(
      "Delete",
      "Delete slide",
      edit(() => {
        if (model.slides.length === 1) model.slides[0] = { title: "", bullets: [] };
        else {
          model.slides.splice(current, 1);
          current = Math.min(current, model.slides.length - 1);
        }
      })
    ),
    button(
      "▲",
      "Move slide up",
      edit(() => {
        if (current === 0) return;
        model.slides.splice(current - 1, 0, ...model.slides.splice(current, 1));
        current--;
      })
    ),
    button(
      "▼",
      "Move slide down",
      edit(() => {
        if (current >= model.slides.length - 1) return;
        model.slides.splice(current + 1, 0, ...model.slides.splice(current, 1));
        current++;
      })
    ),
    separator(),
    button(
      "⇄ RTL",
      "Toggle right-to-left slide",
      edit(() => {
        const s = slide();
        if (s.rtl) delete s.rtl;
        else s.rtl = true;
      })
    ),
    separator(),
    button("▶ Present", "Present from current slide (F5)", () => present())
  );

  function syncFromEditor() {
    const s = slide();
    s.title = (title.textContent ?? "").replace(/\n/g, " ").trim();
    s.bullets = Array.from(body.querySelectorAll("li"))
      .map((li) => (li.textContent ?? "").trim())
      .filter((t) => t !== "");
    if (!body.querySelector("li") && body.textContent?.trim())
      s.bullets = body.textContent
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);
  }

  function renderEditor() {
    const s = slide();
    stage.dir = s.rtl ? "rtl" : "ltr";
    title.textContent = s.title;
    body.replaceChildren(...(s.bullets.length ? s.bullets : [""]).map((b) => el("li", {}, b || el("br"))));
  }

  function renderList() {
    list.replaceChildren(
      ...model.slides.map((s, i) => {
        const item = el(
          "li",
          { class: i === current ? "active" : "", tabindex: 0, "aria-current": i === current ? "true" : undefined },
          el(
            "div",
            { class: "thumb", dir: s.rtl ? "rtl" : "ltr" },
            el("strong", { text: s.title || "Untitled" }),
            ...s.bullets.slice(0, 4).map((b) => el("span", { text: b }))
          )
        );
        const go = () => {
          syncFromEditor();
          current = i;
          renderAll();
        };
        item.addEventListener("click", go);
        item.addEventListener("keydown", (e) => e.key === "Enter" && go());
        return item;
      })
    );
    counter.textContent = `Slide ${current + 1} of ${model.slides.length}`;
  }

  function renderAll() {
    renderEditor();
    renderList();
  }

  const onInput = () => {
    syncFromEditor();
    markDirty();
    renderList();
  };
  title.addEventListener("input", onInput);
  body.addEventListener("input", onInput);
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      body.focus();
    }
  });
  body.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
  });

  function present() {
    syncFromEditor();
    let index = current;
    const view = el("div", { class: "presenter", tabindex: 0, role: "dialog", "aria-label": "Slide show" });
    const draw = () => {
      const s = model.slides[index] as SlideModel;
      view.replaceChildren(
        el(
          "div",
          { class: "slide show", dir: s.rtl ? "rtl" : "ltr" },
          el("div", { class: "slide-title", text: s.title }),
          el("ul", { class: "slide-body" }, ...s.bullets.map((b) => el("li", { text: b })))
        ),
        el("div", {
          class: "presenter-hint",
          text: `${index + 1} / ${model.slides.length} · ← → to navigate · Esc to exit`
        })
      );
    };
    const close = () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      view.remove();
    };
    view.addEventListener("keydown", (e) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key))
        index = Math.min(model.slides.length - 1, index + 1);
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) index = Math.max(0, index - 1);
      else if (e.key === "Escape") return close();
      draw();
    });
    view.addEventListener("click", () => {
      index = Math.min(model.slides.length - 1, index + 1);
      draw();
    });
    document.addEventListener(
      "fullscreenchange",
      () => !document.fullscreenElement && view.isConnected && view.remove(),
      { once: true }
    );
    document.body.append(view);
    draw();
    view.focus();
    void view.requestFullscreen().catch(() => undefined);
  }
  document.addEventListener("keydown", (e) => e.key === "F5" && present());

  renderAll();
}
