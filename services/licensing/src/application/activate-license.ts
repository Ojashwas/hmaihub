import { addTerm, computeGraceUntil, normalizeActivationCode, SUITE_PRODUCT } from "@hyperoffice/licensing-core";
import { newId } from "../domain/ids.ts";
import type { ActivationCodeRecord, InstallationRecord, LicenseRecord } from "../domain/types.ts";
import type { LicensingRepository } from "../infrastructure/database/repository.ts";
import { hashActivationCode } from "../infrastructure/hashing/code-hash.ts";
import type { FixedWindowRateLimiter } from "../infrastructure/rate-limiting/fixed-window.ts";
import type { GrantSigner } from "../infrastructure/signing/signer.ts";
import type { LicensingConfig } from "./config.ts";
import { LicensingError } from "./errors.ts";
import { signLicenseGrant } from "./grant-issuer.ts";
import { requestHash, RequestValidationError, validateActivationRequest, validateIdempotencyKey } from "./requests.ts";

export interface LicensingDeps {
  repo: LicensingRepository;
  signer: GrantSigner;
  pepper: Uint8Array;
  limiter: FixedWindowRateLimiter;
  config: LicensingConfig;
}

export interface ActivationResponse {
  activation_id: string;
  license_grant: string;
  server_time: string;
  public_key_set_url: string;
  support_reference: string;
}

export interface ActivationCommand {
  body: unknown;
  idempotencyKey: unknown;
  sourceIp: string;
  now: Date;
}

const REDEEMABLE = new Set(["GENERATED", "ASSIGNED", "REDEEMED"]);

export const supportReference = () => `HSR-${newId("hsr").slice(4)}`;

export function productMatches(licensed: readonly string[], requested: string): boolean {
  return licensed.includes(requested) || licensed.includes(SUITE_PRODUCT);
}

/** The suite shell hosts every product, so it may activate any product code. */
const activationProductMatches = (templateProducts: readonly string[], requested: string): boolean =>
  requested === SUITE_PRODUCT || productMatches(templateProducts, requested);

/** POST /v1/activations */
export async function activateLicense(deps: LicensingDeps, cmd: ActivationCommand): Promise<ActivationResponse> {
  const { repo, signer, pepper, limiter, config } = deps;
  const ref = supportReference();
  const nowS = Math.floor(cmd.now.getTime() / 1000);

  let req;
  let idempotencyKey: string;
  try {
    req = validateActivationRequest(cmd.body);
    idempotencyKey = validateIdempotencyKey(cmd.idempotencyKey);
  } catch (err) {
    if (err instanceof RequestValidationError) throw new LicensingError("INVALID_REQUEST", err.message, ref);
    throw err;
  }

  const limits = config.rateLimits;
  for (const [key, rule] of [
    [`ip:${cmd.sourceIp}`, limits.perIp],
    [`ins:${req.installation_id}`, limits.perInstallation],
    [`dev:${req.device_fingerprint}`, limits.perFingerprint]
  ] as const) {
    const d = limiter.hit(key, rule, nowS);
    if (!d.allowed) throw new LicensingError("RATE_LIMITED", `limit:${key.split(":")[0]}`, ref, d.retryAfterSeconds);
  }

  const code = normalizeActivationCode(req.code);
  const codeHash = code ? hashActivationCode(pepper, code) : undefined;
  if (codeHash) {
    const d = limiter.peek(`code:${codeHash}`, limits.perCodeFailures, nowS);
    if (!d.allowed) throw new LicensingError("RATE_LIMITED", "limit:code", ref, d.retryAfterSeconds);
  }
  const hash = requestHash({ ...req, code: codeHash ?? "malformed" });
  const fail = (reason: string): never => {
    throw new LicensingError("ACTIVATION_FAILED", reason, ref);
  };
  let codeId = "unknown";

  try {
    return await repo.transaction(async (tx) => {
      const prior = await tx.getIdempotency("activation", idempotencyKey);
      if (prior) {
        if (prior.requestHash !== hash) throw new LicensingError("IDEMPOTENCY_CONFLICT", "idempotency-mismatch", ref);
        return prior.response as ActivationResponse;
      }
      if (await tx.nonceSeen(req.nonce, nowS - config.replayWindowSeconds)) {
        throw new LicensingError("REPLAY_DETECTED", "nonce-replay", ref);
      }
      if (!codeHash) return fail("MALFORMED_CODE");

      const rec = await tx.getCodeByHash(codeHash);
      if (!rec) return fail("UNKNOWN_CODE");
      codeId = rec.codeId;
      const template = await tx.getTemplate(rec.templateId);
      if (!template || template.kind !== "activation") return fail("NOT_AN_ACTIVATION_CODE");
      if (!REDEEMABLE.has(rec.status)) return fail(`CODE_${rec.status}`);
      if (rec.validFrom !== undefined && nowS < rec.validFrom) return fail("CODE_NOT_YET_VALID");
      if (rec.status !== "REDEEMED" && nowS > rec.redeemBy) return fail("CODE_REDEEM_BY_PASSED");
      if (!activationProductMatches(template.products, req.product)) return fail("WRONG_PRODUCT");

      let license: LicenseRecord | undefined = rec.licenseId ? await tx.getLicense(rec.licenseId) : undefined;
      if (rec.licenseId && license?.status !== "ACTIVE") return fail("LICENSE_NOT_ACTIVE");

      let installation: InstallationRecord | undefined = license
        ? await tx.getInstallation(license.licenseId, req.installation_id)
        : undefined;
      const reuse = installation?.status === "ACTIVE";
      if (reuse && installation?.deviceFingerprint !== req.device_fingerprint)
        return fail("DEVICE_CHANGED_REQUIRES_RESET");
      if (!reuse && rec.activationCount >= rec.maxInstallations) return fail("CODE_ACTIVATION_LIMIT");

      const updatedCode: ActivationCodeRecord = { ...rec, status: "REDEEMED" };
      if (!license) {
        const start = template.contractStart ?? nowS;
        const exp = addTerm(start, template.term ?? config.defaultTerm);
        const customerId = rec.customerId ?? newId("cus");
        license = {
          licenseId: newId("lic"),
          customerId,
          ...(rec.orderId === undefined ? {} : { orderId: rec.orderId }),
          edition: template.edition,
          licenseMode: template.licenseMode,
          products: [...template.products],
          features: [...template.features],
          limits: { ...template.limits },
          nbf: start,
          exp,
          graceUntil: computeGraceUntil(exp, config.graceDays),
          activatedAt: nowS,
          licenseVersion: 1,
          status: "ACTIVE"
        };
        updatedCode.licenseId = license.licenseId;
        updatedCode.customerId = customerId;
      }

      if (reuse && installation) {
        installation = { ...installation, lastActivatedAt: nowS };
      } else {
        if ((await tx.countActiveInstallations(license.licenseId)) >= license.limits.installations) {
          return fail("LICENSE_INSTALLATION_LIMIT");
        }
        installation = {
          installationId: req.installation_id,
          licenseId: license.licenseId,
          deviceFingerprint: req.device_fingerprint,
          status: "ACTIVE",
          firstActivatedAt: nowS,
          lastActivatedAt: nowS
        };
        updatedCode.activationCount = rec.activationCount + 1;
      }

      const activationId = newId("act");
      const previous = await tx.getLatestGrant(license.licenseId, installation.installationId);
      const { token, grant } = await signLicenseGrant(signer, config, license, installation, nowS, previous?.jti);

      await tx.putCode(updatedCode);
      await tx.putLicense(license);
      await tx.putInstallation(installation);
      await tx.putActivation({
        activationId,
        licenseId: license.licenseId,
        installationId: installation.installationId,
        codeId: rec.codeId,
        createdAt: nowS,
        appVersion: req.app_version,
        platform: req.platform
      });
      await tx.putGrant(grant);

      const response: ActivationResponse = {
        activation_id: activationId,
        license_grant: token,
        server_time: new Date(nowS * 1000).toISOString(),
        public_key_set_url: config.publicKeySetUrl,
        support_reference: ref
      };
      await tx.putIdempotency({
        scope: "activation",
        key: idempotencyKey,
        requestHash: hash,
        response,
        createdAt: nowS
      });
      await tx.putNonce(req.nonce, nowS);
      await tx.appendAudit(
        {
          actor: `installation:${installation.installationId}`,
          action: "license.activate",
          subject: license.licenseId,
          result: "SUCCESS",
          correlationId: ref,
          changes: {
            after: { codeId: rec.codeId, activationCount: updatedCode.activationCount, kid: grant.kid, jti: grant.jti }
          }
        },
        cmd.now
      );
      return response;
    });
  } catch (err) {
    if (err instanceof LicensingError && err.publicCode === "ACTIVATION_FAILED") {
      if (codeHash) limiter.hit(`code:${codeHash}`, limits.perCodeFailures, nowS);
      await repo.audit(
        {
          actor: `installation:${req.installation_id}`,
          action: "license.activate",
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
