import { generateActivationCode } from "../domain/activation-code.ts";
import { newId } from "../domain/ids.ts";
import type { ActivationCodeRecord } from "../domain/types.ts";
import type { LicensingDeps } from "./activate-license.ts";
import { LicensingError } from "./errors.ts";
import { hashActivationCode } from "../infrastructure/hashing/code-hash.ts";

export interface IssueCodesCommand {
  templateId: string;
  quantity: number;
  redeemBy: number;
  maxInstallations: number;
  channel: string;
  orderId: string;
  externalOrderId?: string;
  reseller?: string;
  customerId?: string;
  createdBy: string;
  /** Required, and distinct from createdBy, when quantity exceeds the bulk threshold. */
  approvedBy?: string;
  now: Date;
}

export interface IssuedCode {
  codeId: string;
  /** Plaintext code. Returned exactly once and never persisted. */
  code: string;
}

/**
 * Generates commercial codes for a verified order. Only HMAC lookup hashes
 * are stored; the audit record contains code IDs, never codes.
 */
export async function issueCodes(
  deps: Pick<LicensingDeps, "repo" | "pepper" | "config">,
  cmd: IssueCodesCommand
): Promise<IssuedCode[]> {
  const ref = `HSR-${newId("hsr").slice(4)}`;
  if (!Number.isInteger(cmd.quantity) || cmd.quantity < 1 || cmd.quantity > 10_000) {
    throw new LicensingError("INVALID_REQUEST", "quantity", ref);
  }
  if (!Number.isInteger(cmd.maxInstallations) || cmd.maxInstallations < 1) {
    throw new LicensingError("INVALID_REQUEST", "maxInstallations", ref);
  }
  if (cmd.quantity > deps.config.bulkApprovalThreshold && (!cmd.approvedBy || cmd.approvedBy === cmd.createdBy)) {
    throw new LicensingError("APPROVAL_REQUIRED", "dual-approval", ref);
  }
  const nowS = Math.floor(cmd.now.getTime() / 1000);

  return deps.repo.transaction(async (tx) => {
    if (!(await tx.getTemplate(cmd.templateId))) throw new LicensingError("INVALID_REQUEST", "unknown-template", ref);
    const issued: IssuedCode[] = [];
    while (issued.length < cmd.quantity) {
      const code = generateActivationCode();
      const codeHash = hashActivationCode(deps.pepper, code);
      if (await tx.getCodeByHash(codeHash)) continue;
      const record: ActivationCodeRecord = {
        codeId: newId("code"),
        codeHash,
        templateId: cmd.templateId,
        status: cmd.customerId ? "ASSIGNED" : "GENERATED",
        issuedAt: nowS,
        redeemBy: cmd.redeemBy,
        maxInstallations: cmd.maxInstallations,
        activationCount: 0,
        channel: cmd.channel,
        orderId: cmd.orderId,
        createdBy: cmd.createdBy,
        fraudFlags: [],
        ...(cmd.externalOrderId === undefined ? {} : { externalOrderId: cmd.externalOrderId }),
        ...(cmd.reseller === undefined ? {} : { reseller: cmd.reseller }),
        ...(cmd.customerId === undefined ? {} : { customerId: cmd.customerId })
      };
      await tx.putCode(record);
      issued.push({ codeId: record.codeId, code });
    }
    await tx.appendAudit(
      {
        actor: cmd.createdBy,
        action: "codes.generate",
        subject: cmd.orderId,
        result: "SUCCESS",
        correlationId: ref,
        changes: {
          after: {
            templateId: cmd.templateId,
            quantity: cmd.quantity,
            codeIds: issued.map((c) => c.codeId),
            approvedBy: cmd.approvedBy ?? null
          }
        }
      },
      cmd.now
    );
    return issued;
  });
}
