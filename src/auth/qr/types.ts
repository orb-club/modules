import type { SDKContext, SDKPlugin } from "../../core/types";

/**
 * Why a sign-in attempt ended without credentials.
 *
 * - `expired`: the approval window (`expiresAt`, ~5 minutes) passed.
 * - `cancelled`: the caller aborted.
 * - `unavailable`: the backend refused (`status: FAILED`, a 4xx, or an origin
 *   whose `/.well-known/orb-siwo.json` manifest is missing or wrong).
 * - `provisioning`: a first-use origin was still being provisioned after the
 *   bounded number of retries. Trying again a few minutes later usually works.
 * - `invalid`: the backend answered with something that is not the protocol's
 *   shape (including a `refreshToken`, which the protocol never issues).
 * - `configuration`: the caller used options or helpers from the removed legacy flow.
 */
export type QrFailureReason =
  | "expired"
  | "cancelled"
  | "unavailable"
  | "provisioning"
  | "invalid"
  | "configuration";

/** Display-only approval data. Render `qrCode` (or a QR of `deepLink`) until `expiresAt`. */
export type QrSignInApproval = {
  /** `data:image/png;base64,...` QR image of `deepLink`. */
  qrCode: string;
  /** `orbapp://orb/approve?secret=<64 hex>`; offer it as an "Open Orb app" link on touch devices. */
  deepLink: string;
  /** Unix milliseconds after which the approval can no longer be used. */
  expiresAt: number;
};

export type QrConnectResult = {
  processed: true;
  source: "lens";
  /** The signed-in Lens account address. */
  user_id: string;
  idToken: string;
  accessToken: string;
  /**
   * Unix milliseconds when `accessToken` expires (its JWT `exp`), or `null`
   * when the token carries no readable `exp`. No refresh token is issued: end
   * the session at this moment and prompt a new sign-in.
   */
  expiresAt: number | null;
};

export type QrConnectOptions = {
  signal?: AbortSignal;
  /** Called once with the approval to display. */
  onInit?: (approval: QrSignInApproval) => void | Promise<void>;
  /** Called on each first-use provisioning wait (the origin is being set up). */
  onProvisioning?: () => void | Promise<void>;
  /** @deprecated Removed with the legacy flow. Credentials are fixed to id + access tokens. */
  credentials?: never;
  /** @deprecated Removed with the legacy flow. Custom headers would break the CORS contract. */
  headers?: never;
  /** @deprecated The attempt now runs until the approval's `expiresAt`. Use `signal` to stop early. */
  timeoutMs?: never;
  /** @deprecated Set `pollIntervalMs` on the plugin config instead. */
  pollIntervalMs?: never;
};

export type QrAuthPluginConfig = {
  /** Sign-in API origin. Default `https://orbapi.xyz`. Must be an `https:` origin with no path. */
  baseUrl?: string;
  /** Poll cadence in ms. Default `2_500`; values below `2_000` are raised to stay inside the per-session poll limit. */
  pollIntervalMs?: number;
  /** Per-request timeout in ms. Default `10_000`. */
  requestTimeoutMs?: number;
  /** Wait between first-use provisioning retries in ms. Default `10_000`. */
  provisioningRetryMs?: number;
  /** Maximum init attempts while the origin is provisioning. Default `6`. */
  provisioningAttempts?: number;
  /** @deprecated `/init-sign-in` is disabled. Use `baseUrl`. */
  initUrl?: never;
  /** @deprecated `/poll-sign-in` is disabled. Use `baseUrl`. */
  pollUrl?: never;
  /** @deprecated Removed with the legacy flow. */
  credentials?: never;
  /** @deprecated Removed with the legacy flow. */
  headers?: never;
  /** @deprecated The attempt now runs until the approval's `expiresAt`. */
  timeoutMs?: never;
  /** @deprecated Use `requestTimeoutMs`. */
  initTimeoutMs?: never;
  /** @deprecated Use `requestTimeoutMs`. */
  pollTimeoutMs?: never;
  /** @deprecated Responses are validated against the protocol; custom parsers are not supported. */
  parseInitResponse?: never;
  /** @deprecated Responses are validated against the protocol; custom parsers are not supported. */
  parsePollResponse?: never;
};

export class QrAuthError extends Error {
  code: string;
  reason: QrFailureReason;

  constructor(
    message: string,
    code: string,
    reason: QrFailureReason = "unavailable",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "QrAuthError";
    this.code = code;
    this.reason = reason;
  }
}

/** The backend refused the attempt. */
export class QrRequestError extends QrAuthError {
  stage: "init" | "poll";
  status?: number;

  constructor(
    stage: "init" | "poll",
    message: string,
    options?: {
      code?: string;
      status?: number;
      cause?: unknown;
    },
  ) {
    super(message, options?.code ?? "QR_REQUEST_FAILED", "unavailable", {
      cause: options?.cause,
    });
    this.name = "QrRequestError";
    this.stage = stage;
    this.status = options?.status;
  }
}

/** The backend answered outside the protocol's shape. */
export class QrResponseError extends QrAuthError {
  stage: "init" | "poll";

  constructor(
    stage: "init" | "poll",
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message, options?.code ?? "QR_RESPONSE_INVALID", "invalid", { cause: options?.cause });
    this.name = "QrResponseError";
    this.stage = stage;
  }
}

/** The approval window passed before the viewer approved. Start a new attempt. */
export class QrTimeoutError extends QrAuthError {
  constructor(message = "Sign in with Orb expired. Start a new attempt.", options?: ErrorOptions) {
    super(message, "QR_TIMEOUT", "expired", options);
    this.name = "QrTimeoutError";
  }
}

export class QrCancelledError extends QrAuthError {
  constructor(message = "Sign in with Orb was cancelled.", options?: ErrorOptions) {
    super(message, "QR_CANCELLED", "cancelled", options);
    this.name = "QrCancelledError";
  }
}

/** A first-use origin was still being provisioned after the bounded retries. */
export class QrProvisioningError extends QrAuthError {
  constructor(
    message = "Sign in with Orb is still being set up for this site. Try again in a few minutes.",
    options?: ErrorOptions,
  ) {
    super(message, "QR_PROVISIONING", "provisioning", options);
    this.name = "QrProvisioningError";
  }
}

/** Legacy QR options or helpers were used. They targeted endpoints that are disabled. */
export class QrLegacyFlowError extends QrAuthError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "QR_LEGACY_FLOW_REMOVED", "configuration", options);
    this.name = "QrLegacyFlowError";
  }
}

/** @deprecated Always throws `QrLegacyFlowError`. */
export type QrLegacyHelper = (...args: unknown[]) => never;

export type QrAuthCapabilities = {
  connectWithQr: (options?: QrConnectOptions) => Promise<QrConnectResult>;
  /** @deprecated `/init-sign-in` is disabled; always throws `QrLegacyFlowError`. */
  createQrInitRequest: QrLegacyHelper;
  /** @deprecated `/poll-sign-in` is disabled; always throws `QrLegacyFlowError`. */
  createQrPollRequest: QrLegacyHelper;
  /** @deprecated Always throws `QrLegacyFlowError`. */
  parseQrInitResponse: QrLegacyHelper;
  /** @deprecated Always throws `QrLegacyFlowError`. */
  parseQrPollResponse: QrLegacyHelper;
};

export type QrAuthPlugin = SDKPlugin<"auth", QrAuthCapabilities>;

export type QrAuthContext = SDKContext;
