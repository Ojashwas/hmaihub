export type PublicErrorCode =
  | "INVALID_REQUEST"
  | "ACTIVATION_FAILED"
  | "RENEWAL_FAILED"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_CONFLICT"
  | "REPLAY_DETECTED"
  | "APPROVAL_REQUIRED";

const HTTP: Record<PublicErrorCode, number> = {
  INVALID_REQUEST: 400,
  ACTIVATION_FAILED: 422,
  RENEWAL_FAILED: 422,
  RATE_LIMITED: 429,
  IDEMPOTENCY_CONFLICT: 409,
  REPLAY_DETECTED: 409,
  APPROVAL_REQUIRED: 403
};

const MESSAGES: Record<PublicErrorCode, string> = {
  INVALID_REQUEST: "The request is not valid.",
  ACTIVATION_FAILED: "This code could not be activated. Check the code or contact support with the reference.",
  RENEWAL_FAILED: "This renewal could not be applied. Check the code or contact support with the reference.",
  RATE_LIMITED: "Too many attempts. Try again later.",
  IDEMPOTENCY_CONFLICT: "The idempotency key was reused with a different request.",
  REPLAY_DETECTED: "The request was already processed.",
  APPROVAL_REQUIRED: "A second approver is required for this operation."
};

/**
 * `internalReason` is for audit only and is never returned to callers, so
 * "unknown code" and "code already used" are indistinguishable publicly.
 */
export class LicensingError extends Error {
  readonly publicCode: PublicErrorCode;
  readonly internalReason: string;
  readonly httpStatus: number;
  readonly supportReference: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    publicCode: PublicErrorCode,
    internalReason: string,
    supportReference: string,
    retryAfterSeconds?: number
  ) {
    super(MESSAGES[publicCode]);
    this.name = "LicensingError";
    this.publicCode = publicCode;
    this.internalReason = internalReason;
    this.httpStatus = HTTP[publicCode];
    this.supportReference = supportReference;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  toPublic(): { error: PublicErrorCode; message: string; support_reference: string; retry_after_seconds?: number } {
    return {
      error: this.publicCode,
      message: this.message,
      support_reference: this.supportReference,
      ...(this.retryAfterSeconds === undefined ? {} : { retry_after_seconds: this.retryAfterSeconds })
    };
  }
}
