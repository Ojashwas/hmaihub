import { SUITE_PRODUCT } from "@hyperoffice/licensing-core";

export const PRODUCTS = ["hyperdoc", "hypersheet", "hyperdeck", "hyperplan", "hyperai", "extension-sdk"] as const;
export type ProductId = (typeof PRODUCTS)[number];

export function isProductLicensed(licensed: readonly string[], product: ProductId): boolean {
  return licensed.includes(product) || licensed.includes(SUITE_PRODUCT);
}
