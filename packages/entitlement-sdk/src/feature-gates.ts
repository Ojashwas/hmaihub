import type { LicenseSnapshot, LicenseStatus } from "@hyperoffice/licensing-core";
import { CAPABILITY_MAP, type CapabilityDefinition } from "./capability-map.ts";
import { isProductLicensed } from "./product-map.ts";

export interface EntitlementDecision {
  capability: string;
  status: LicenseStatus;
  allowed: boolean;
  reason: string;
}

export class EntitlementError extends Error {
  readonly decision: EntitlementDecision;

  constructor(decision: EntitlementDecision) {
    super(`Capability ${decision.capability} denied: ${decision.status} (${decision.reason})`);
    this.name = "EntitlementError";
    this.decision = decision;
  }
}

export interface Entitlements {
  /** Returns a structured decision. Never throws. */
  require(capability: string): EntitlementDecision;
  /** Throws EntitlementError when denied. Use in application services and workers. */
  assert(capability: string): void;
}

const USABLE: ReadonlySet<LicenseStatus> = new Set(["ALLOWED", "GRACE_PERIOD"]);

function decide(
  def: CapabilityDefinition | undefined,
  capability: string,
  snapshot: LicenseSnapshot | null
): EntitlementDecision {
  const deny = (status: LicenseStatus, reason: string): EntitlementDecision => ({
    capability,
    status,
    allowed: false,
    reason
  });
  if (!def) return deny("NOT_ENTITLED", "UNKNOWN_CAPABILITY");
  if (def.class === "data-access")
    return { capability, status: "ALLOWED", allowed: true, reason: "DATA_ACCESS_ALWAYS_ALLOWED" };
  if (!snapshot) return deny("LICENSING_COMPONENT_UNAVAILABLE", "NO_LICENSE_STATE");
  if (!USABLE.has(snapshot.status)) return deny(snapshot.status, "LICENSE_NOT_USABLE");
  if (def.product && !isProductLicensed(snapshot.products, def.product))
    return deny("NOT_ENTITLED", "PRODUCT_NOT_LICENSED");
  if (def.anyOf && !def.anyOf.some((f) => snapshot.features.includes(f)))
    return deny("NOT_ENTITLED", "FEATURE_NOT_LICENSED");
  return { capability, status: snapshot.status, allowed: true, reason: "ENTITLED" };
}

/**
 * Creates the central gate. `getSnapshot` must return the latest locally
 * verified licence state; failures fail closed for licensed capabilities and
 * open for data access.
 */
export function createEntitlements(getSnapshot: () => LicenseSnapshot | null): Entitlements {
  const resolve = (capability: string): EntitlementDecision => {
    let snapshot: LicenseSnapshot | null;
    try {
      snapshot = getSnapshot();
    } catch {
      snapshot = null;
    }
    return decide(CAPABILITY_MAP.get(capability), capability, snapshot);
  };
  return {
    require: resolve,
    assert(capability) {
      const decision = resolve(capability);
      if (!decision.allowed) throw new EntitlementError(decision);
    }
  };
}
