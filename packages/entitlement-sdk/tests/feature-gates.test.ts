import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import type { LicenseSnapshot, LicenseStatus } from "@hyperoffice/licensing-core";
import { CAPABILITIES, createEntitlements, EntitlementError } from "../src/index.ts";

const snapshot = (overrides: Partial<LicenseSnapshot> = {}): LicenseSnapshot => ({
  status: "ALLOWED",
  products: ["hyperdoc", "hypersheet"],
  features: ["documents.edit", "spreadsheets.formulas", "office.pdf_export"],
  ...overrides
});

const ALL_STATUSES: LicenseStatus[] = [
  "ALLOWED",
  "NOT_ENTITLED",
  "EXPIRED",
  "GRACE_PERIOD",
  "INVALID_SIGNATURE",
  "WRONG_INSTALLATION",
  "NOT_YET_VALID",
  "UNSUPPORTED_LICENSE_VERSION",
  "CLOCK_TAMPER_SUSPECTED",
  "LICENSING_COMPONENT_UNAVAILABLE"
];

describe("feature gates", () => {
  it("allows entitled capabilities", () => {
    const e = createEntitlements(() => snapshot());
    assert.deepEqual(e.require("documents.edit"), {
      capability: "documents.edit",
      status: "ALLOWED",
      allowed: true,
      reason: "ENTITLED"
    });
    assert.equal(e.require("office.export.pdf").allowed, true);
  });

  it("denies capabilities whose feature or product is not licensed", () => {
    const e = createEntitlements(() => snapshot());
    assert.equal(e.require("presentations.edit").reason, "PRODUCT_NOT_LICENSED");
    assert.equal(e.require("hyperdoc.track_changes").reason, "FEATURE_NOT_LICENSED");
    assert.equal(e.require("ai.generate").status, "NOT_ENTITLED");
  });

  it("treats the suite product as covering every product", () => {
    const e = createEntitlements(() => snapshot({ products: ["hyperoffice-suite"], features: ["presentations.edit"] }));
    assert.equal(e.require("presentations.edit").allowed, true);
  });

  it("keeps working during the grace period and reports it", () => {
    const d = createEntitlements(() => snapshot({ status: "GRACE_PERIOD" })).require("documents.edit");
    assert.equal(d.allowed, true);
    assert.equal(d.status, "GRACE_PERIOD");
  });

  it("fails closed for paid capabilities on every unusable status", () => {
    for (const status of ALL_STATUSES.filter((s) => s !== "ALLOWED" && s !== "GRACE_PERIOD")) {
      const d = createEntitlements(() => snapshot({ status })).require("documents.edit");
      assert.equal(d.allowed, false, status);
      assert.equal(d.status, status);
    }
  });

  it("property: data access is always allowed, whatever the licence state", () => {
    const dataAccess = CAPABILITIES.filter((c) => c.class === "data-access").map((c) => c.id);
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        fc.constantFrom(...dataAccess),
        fc.boolean(),
        (status, cap, broken) => {
          const e = createEntitlements(() => {
            if (broken) throw new Error("secure store unavailable");
            return snapshot({ status, products: [], features: [] });
          });
          assert.equal(e.require(cap).allowed, true);
        }
      )
    );
  });

  it("reports LICENSING_COMPONENT_UNAVAILABLE when state cannot be read", () => {
    const e = createEntitlements(() => {
      throw new Error("boom");
    });
    assert.equal(e.require("documents.edit").status, "LICENSING_COMPONENT_UNAVAILABLE");
    assert.equal(createEntitlements(() => null).require("documents.edit").status, "LICENSING_COMPONENT_UNAVAILABLE");
  });

  it("denies unknown capabilities and throws from assert()", () => {
    const e = createEntitlements(() => snapshot());
    assert.equal(e.require("documents.edti").reason, "UNKNOWN_CAPABILITY");
    assert.throws(() => e.assert("presentations.edit"), EntitlementError);
    assert.doesNotThrow(() => e.assert("documents.edit"));
  });

  it("capability identifiers are unique and well-formed", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/);
  });
});
