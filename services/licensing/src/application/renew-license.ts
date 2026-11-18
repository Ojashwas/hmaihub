import {
  addTerm,
  computeGraceUntil,
  computeRenewalWindow,
  LicenseTokenError,
  normalizeActivationCode,
  parseGrantClaims,
  verifyCompactJws,
  type LicenseGrantClaims
} from "@hyperoffice/licensing-core";
import { hashActivationCode } from "../infrastructure/hashing/code-hash.ts";
import type { LicenseRecord } from "../domain/types.ts";
import { productMatches, supportReference, type LicensingDeps } from "./activate-license.ts";
import { LicensingError } from "./errors.ts";
import { signLicenseGrant } from "./grant-issuer.ts";
import { requestHash, RequestValidationError, validateIdempotencyKey, validateRenewalRequest } from "./requests.ts";

export interface RenewalResponse {
  license_grant: string;
  license_version: number;
  previous_expiry: string;
  new_expiry: string;
  server_time: string;
  support_reference: string;
}

export interface RenewalCommand {
  licenseId: string;
  body: unknown;
  idempotencyKey: unknown;
  sourceIp: string;
  now: Date;
}

const iso = (s: number) => new Date(s * 1000).toISOString();

/** POST /v1/licenses/{license_id}/renewals — applies a Renewal Code or Feature Code. */
export async function renewLicense(deps: LicensingDeps, cmd: RenewalCommand): Promise<RenewalResponse> {
  const { repo, signer, pepper, limiter, config } = deps;
  const ref = supportReference();
  const nowS = Math.floor(cmd.now.getTime() / 1000);

  let req;
  let idempotencyKey: string;
  try {
    req = validateRenewalRequest(cmd.body);
    idempotencyKey = validateIdempotencyKey(cmd.idempotencyKey);
  } catch (err) {
    if (err instanceof RequestValidationError) throw new LicensingError("INVALID_REQUEST", err.message, ref);
    throw err;
  }
  for (const [key, rule] of [
    [`ip:${cmd.sourceIp}`, config.rateLimits.perIp],
    [`ins:${req.installation_id}`, config.rateLimits.perInstallation]
  ] as const) {
    const d = limiter.hit(key, rule, nowS);
    if (!d.allowed) throw new LicensingError("RATE_LIMITED", "limit", ref, d.retryAfterSeconds);
  }

  const fail = (reason: string): never => {
    throw new LicensingError("RENEWAL_FAILED", reason, ref);
  };

  // The presented grant may be expired; only its authenticity and binding matter here.
  let presented: LicenseGrantClaims;
  try {
    presented = parseGrantClaims(
      verifyCompactJws(req.current_license_grant, { trustedKeys: config.verificationKeys }).payload
    );
  } catch (err) {
    if (err instanceof LicenseTokenError) return fail(`PRESENTED_GRANT_${err.code}`);
    throw err;
  }
  if (
    presented.iss !== config.issuer ||
    presented.aud !== config.audience ||
    presented.license_id !== cmd.licenseId ||
    presented.installation_id !== req.installation_id ||
    presented.device_binding !== req.device_fingerprint
  ) {
    return fail("PRESENTED_GRANT_MISMATCH");
  }

  const code = normalizeActivationCode(req.extension_code);
  if (!code) return fail("MALFORMED_CODE");
  const codeHash = hashActivationCode(pepper, code);
  const limited = limiter.peek(`code:${codeHash}`, config.rateLimits.perCodeFailures, nowS);
  if (!limited.allowed) throw new LicensingError("RATE_LIMITED", "limit:code", ref, limited.retryAfterSeconds);
  const hash = requestHash({ ...req, extension_code: codeHash, license_id: cmd.licenseId });
  let codeId = "unknown";

  try {
    return await repo.transaction(async (tx) => {
      const prior = await tx.getIdempotency("renewal", idempotencyKey);
      if (prior) {
        if (prior.requestHash !== hash) throw new LicensingError("IDEMPOTENCY_CONFLICT", "idempotency-mismatch", ref);
        return prior.response as RenewalResponse;
      }
      if (await tx.nonceSeen(req.nonce, nowS - config.replayWindowSeconds)) {
        throw new LicensingError("REPLAY_DETECTED", "nonce-replay", ref);
      }

      const license = await tx.getLicense(cmd.licenseId);
      if (!license || license.status !== "ACTIVE") return fail("LICENSE_NOT_ACTIVE");
      if (presented.license_version > license.licenseVersion) return fail("PRESENTED_GRANT_FROM_FUTURE");
      const installation = await tx.getInstallation(license.licenseId, req.installation_id);
      if (installation?.status !== "ACTIVE" || installation.deviceFingerprint !== req.device_fingerprint) {
        return fail("INSTALLATION_NOT_ACTIVE");
      }

      const rec = await tx.getCodeByHash(codeHash);
      if (!rec) return fail("UNKNOWN_CODE");
      codeId = rec.codeId;
      if (rec.status !== "GENERATED" && rec.status !== "ASSIGNED") return fail(`CODE_${rec.status}`);
      if (nowS > rec.redeemBy) return fail("CODE_REDEEM_BY_PASSED");
      if (rec.customerId !== undefined && rec.customerId !== license.customerId) return fail("WRONG_CUSTOMER");
      if (rec.licenseId !== undefined && rec.licenseId !== license.licenseId) return fail("WRONG_LICENSE");
      const template = await tx.getTemplate(rec.templateId);
      if (!template || (template.kind !== "renewal" && template.kind !== "feature")) return fail("NOT_A_RENEWAL_CODE");
      if (!template.products.every((p) => productMatches(license.products, p))) return fail("WRONG_PRODUCT");

      let updated: LicenseRecord;
      if (template.kind === "renewal") {
        if (template.edition !== license.edition) return fail("WRONG_EDITION");
        const window = computeRenewalWindow({
          policy: template.renewalPolicy ?? config.renewalPolicy,
          term: template.term ?? config.defaultTerm,
          currentExpiry: license.exp,
          serverNow: nowS,
          activationDate: license.activatedAt,
          purchaseDate: rec.issuedAt,
          ...(template.coTerminateAt === undefined ? {} : { coTerminateAt: template.coTerminateAt })
        });
        updated = { ...license, exp: window.expiry };
      } else {
        // Feature Code: limits are increments; an optional term extends from the current expiry.
        const exp = template.term ? addTerm(Math.max(license.exp, nowS), template.term) : license.exp;
        updated = {
          ...license,
          exp,
          features: [...new Set([...license.features, ...template.features])],
          limits: {
            installations: license.limits.installations + template.limits.installations,
            users: license.limits.users + template.limits.users,
            ai_monthly_credits: license.limits.ai_monthly_credits + template.limits.ai_monthly_credits
          }
        };
      }
      updated = {
        ...updated,
        graceUntil: computeGraceUntil(updated.exp, config.graceDays),
        licenseVersion: license.licenseVersion + 1
      };

      const previous = await tx.getLatestGrant(license.licenseId, installation.installationId);
      const { token, grant } = await signLicenseGrant(signer, config, updated, installation, nowS, previous?.jti);

      await tx.putCode({
        ...rec,
        status: "REDEEMED",
        activationCount: 1,
        licenseId: license.licenseId,
        customerId: license.customerId
      });
      await tx.putLicense(updated);
      await tx.putGrant(grant);
      const response: RenewalResponse = {
        license_grant: token,
        license_version: updated.licenseVersion,
        previous_expiry: iso(license.exp),
        new_expiry: iso(updated.exp),
        server_time: iso(nowS),
        support_reference: ref
      };
      await tx.putIdempotency({ scope: "renewal", key: idempotencyKey, requestHash: hash, response, createdAt: nowS });
      await tx.putNonce(req.nonce, nowS);
      await tx.appendAudit(
        {
          actor: `installation:${installation.installationId}`,
          action: template.kind === "renewal" ? "license.renew" : "license.add_feature",
          subject: license.licenseId,
          result: "SUCCESS",
          correlationId: ref,
          changes: {
            before: {
              exp: license.exp,
              licenseVersion: license.licenseVersion,
              features: license.features,
              limits: license.limits
            },
            after: {
              exp: updated.exp,
              licenseVersion: updated.licenseVersion,
              features: updated.features,
              limits: updated.limits,
              codeId: rec.codeId,
              supersedes: previous?.jti
            }
          }
        },
        cmd.now
      );
      return response;
    });
  } catch (err) {
    if (err instanceof LicensingError && err.publicCode === "RENEWAL_FAILED") {
      limiter.hit(`code:${codeHash}`, config.rateLimits.perCodeFailures, nowS);
      await repo.audit(
        {
          actor: `installation:${req.installation_id}`,
          action: "license.renew",
          subject: codeId,
          result: "FAILURE",
          correlationId: ref,
          reason: err.internalReason
        },
        cmd.now
      );
    }
    throw err;
  }
}
