import type { ProductId } from "./product-map.ts";

/**
 * data-access: always allowed so users can open, copy, and export their own files.
 * licensed: requires a valid licence, the product, and one of `anyOf` grant features.
 */
export type CapabilityClass = "data-access" | "licensed";

export interface CapabilityDefinition {
  id: string;
  class: CapabilityClass;
  product?: ProductId;
  anyOf?: readonly string[];
}

const dataAccess = (id: string, product: ProductId): CapabilityDefinition => ({ id, class: "data-access", product });
const licensed = (id: string, product: ProductId | undefined, anyOf: readonly string[] = [id]): CapabilityDefinition =>
  product ? { id, class: "licensed", product, anyOf } : { id, class: "licensed", anyOf };

export const CAPABILITIES: readonly CapabilityDefinition[] = [
  dataAccess("documents.open", "hyperdoc"),
  dataAccess("documents.copy", "hyperdoc"),
  dataAccess("documents.export.open_format", "hyperdoc"),
  dataAccess("spreadsheets.open", "hypersheet"),
  dataAccess("spreadsheets.copy", "hypersheet"),
  dataAccess("spreadsheets.export.open_format", "hypersheet"),
  dataAccess("presentations.open", "hyperdeck"),
  dataAccess("presentations.copy", "hyperdeck"),
  dataAccess("presentations.export.open_format", "hyperdeck"),
  dataAccess("projects.open", "hyperplan"),
  dataAccess("projects.copy", "hyperplan"),
  dataAccess("projects.export.open_format", "hyperplan"),

  licensed("documents.edit", "hyperdoc"),
  licensed("spreadsheets.edit", "hypersheet"),
  licensed("spreadsheets.formulas", "hypersheet"),
  licensed("presentations.edit", "hyperdeck"),
  licensed("projects.edit", "hyperplan"),
  licensed("projects.schedule", "hyperplan"),
  licensed("projects.critical_path", "hyperplan", ["projects.schedule"]),
  licensed("office.import", undefined),
  licensed("office.export", undefined),
  licensed("office.export.pdf", undefined, ["office.pdf_export"]),
  licensed("office.legacy_format_import", undefined),

  licensed("hyperdoc.advanced_layout", "hyperdoc"),
  licensed("hyperdoc.track_changes", "hyperdoc"),
  licensed("hypersheet.advanced_formulas", "hypersheet"),
  licensed("hypersheet.pivot_editing", "hypersheet"),
  licensed("hyperdeck.advanced_animation", "hyperdeck"),
  licensed("hyperplan.resource_leveling", "hyperplan"),
  licensed("hyperplan.earned_value", "hyperplan"),
  licensed("collaboration.realtime", undefined),
  licensed("ai.generate", "hyperai", ["ai.standard", "ai.enterprise"]),
  licensed("ai.enterprise", "hyperai")
];

export const CAPABILITY_MAP: ReadonlyMap<string, CapabilityDefinition> = new Map(CAPABILITIES.map((c) => [c.id, c]));
