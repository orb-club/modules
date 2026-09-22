import { QrLegacyFlowError } from "./types";

/**
 * Deprecated stand-ins for the removed legacy QR proxy helpers.
 *
 * `GET /init-sign-in?credentials=...` and `POST /poll-sign-in` are disabled on
 * the Orb backend, so anything built on these helpers (typically a server
 * route proxying sign-in) can only fail. The names stay exported for one minor
 * version so that a stale route fails with this message instead of breaking
 * the whole bundle at import time. They will be removed in the next minor.
 */
const LEGACY_FLOW_MESSAGE =
  "The legacy Orb QR flow (/init-sign-in + /poll-sign-in) is disabled. " +
  "Remove the server proxy route and call connectWithQr() in the browser, which runs " +
  "browser-site Sign in with Orb, and serve /.well-known/orb-siwo.json " +
  "(see @orbclub/modules/auth/site). Migration guide: docs/auth.md.";

function legacy(name: string): (...args: unknown[]) => never {
  return () => {
    throw new QrLegacyFlowError(`${name}() was removed. ${LEGACY_FLOW_MESSAGE}`);
  };
}

/** @deprecated `/init-sign-in` is disabled. Always throws `QrLegacyFlowError`. */
export const createQrInitRequest = legacy("createQrInitRequest");
/** @deprecated `/poll-sign-in` is disabled. Always throws `QrLegacyFlowError`. */
export const createQrPollRequest = legacy("createQrPollRequest");
/** @deprecated Always throws `QrLegacyFlowError`. */
export const parseQrInitResponse = legacy("parseQrInitResponse");
/** @deprecated Always throws `QrLegacyFlowError`. */
export const parseQrPollResponse = legacy("parseQrPollResponse");

export function legacyOptionError(keys: string[]): QrLegacyFlowError {
  return new QrLegacyFlowError(
    `Unsupported legacy QR option(s): ${keys.join(", ")}. ${LEGACY_FLOW_MESSAGE}`,
  );
}
