import type { SlideModel } from "@hyperoffice/office-formats/models";

export const emptySlide = (): SlideModel => ({ title: "", bullets: [] });

/** Removes a slide (keeping at least one) and returns the index to select next. */
export function removeSlide(slides: SlideModel[], index: number): number {
  if (slides.length === 1) {
    slides[0] = emptySlide();
    return 0;
  }
  slides.splice(index, 1);
  return Math.min(index, slides.length - 1);
}

/** Moves a slide by `delta` positions and returns its new index. */
export function moveSlide(slides: SlideModel[], index: number, delta: -1 | 1): number {
  const target = index + delta;
  if (target < 0 || target >= slides.length) return index;
  slides.splice(target, 0, ...slides.splice(index, 1));
  return target;
}

export function toggleRtl(slide: SlideModel): void {
  if (slide.rtl) delete slide.rtl;
  else slide.rtl = true;
}
