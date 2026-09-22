export { connectWithQr, prefersDeepLink } from "./client";
export {
  createQrInitRequest,
  createQrPollRequest,
  parseQrInitResponse,
  parseQrPollResponse,
} from "./legacy";
export { qrAuthPlugin } from "./plugin";
export {
  type QrAuthCapabilities,
  QrAuthError,
  type QrAuthPlugin,
  type QrAuthPluginConfig,
  QrCancelledError,
  type QrConnectOptions,
  type QrConnectResult,
  type QrFailureReason,
  QrLegacyFlowError,
  type QrLegacyHelper,
  QrProvisioningError,
  QrRequestError,
  QrResponseError,
  type QrSignInApproval,
  QrTimeoutError,
} from "./types";
