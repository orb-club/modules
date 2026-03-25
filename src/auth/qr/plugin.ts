import { connectWithQr } from "./client";
import {
  createQrInitRequest,
  createQrPollRequest,
  parseQrInitResponse,
  parseQrPollResponse,
} from "./server";
import type { QrAuthPlugin, QrAuthPluginConfig } from "./types";

export function qrAuthPlugin(config: QrAuthPluginConfig = {}): QrAuthPlugin {
  return {
    name: "auth-qr",
    namespace: "auth",
    extends: "auth",
    requires: ["auth"],
    setup: (context) => ({
      connectWithQr: (options) => connectWithQr(context, config, options),
      createQrInitRequest,
      createQrPollRequest,
      parseQrInitResponse: config.parseInitResponse ?? parseQrInitResponse,
      parseQrPollResponse: config.parsePollResponse ?? parseQrPollResponse,
    }),
  };
}
