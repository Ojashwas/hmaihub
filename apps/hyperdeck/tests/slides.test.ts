import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SlideModel } from "@hyperoffice/office-formats/models";
import { emptySlide, moveSlide, removeSlide, toggleRtl } from "../src/slides/slides.ts";

const deck = (): SlideModel[] => ["A", "B", "C"].map((title) => ({ title, bullets: [] }));

describe("slide operations", () => {
  it("moves slides and stops at the ends", () => {
    const s = deck();
    assert.equal(moveSlide(s, 0, 1), 1);
    assert.deepEqual(
      s.map((x) => x.title),
      ["B", "A", "C"]
    );
    assert.equal(moveSlide(s, 0, -1), 0);
    assert.equal(moveSlide(s, 2, 1), 2);
  });

  it("removes slides but always keeps one", () => {
    const s = deck();
    assert.equal(removeSlide(s, 2), 1);
    assert.equal(removeSlide(s, 0), 0);
    assert.equal(removeSlide(s, 0), 0);
    assert.deepEqual(s, [emptySlide()]);
  });

  it("toggles right-to-left", () => {
    const slide = emptySlide();
    toggleRtl(slide);
    assert.equal(slide.rtl, true);
    toggleRtl(slide);
    assert.equal("rtl" in slide, false);
  });
});
