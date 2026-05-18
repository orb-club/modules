import { createSDK } from "../core/create-sdk";
import type { CreateSDKOptions } from "../core/types";
import {
  DEFAULT_AUTH_REFRESH_URL,
  DEFAULT_AUTH_REVOKE_URL,
  DEFAULT_LENS_GRAPHQL_URL,
  DEFAULT_ORB_QR_CREDENTIALS,
  DEFAULT_ORB_QR_INIT_URL,
  DEFAULT_ORB_QR_POLL_URL,
} from "./defaults";
import { lensAuthPlugin } from "./lens/plugin";
import type { LensAuthCapabilities, LensAuthPluginConfig } from "./lens/types";
import { authPlugin } from "./plugin";
import { qrAuthPlugin } from "./qr/plugin";
import type { QrAuthCapabilities, QrAuthPluginConfig } from "./qr/types";
import type { AuthCapabilities } from "./types";

type OrbLoginSDKOptions = Omit<CreateSDKOptions, "plugins">;

export type OrbLoginConfig = OrbLoginSDKOptions & {
  qr?: QrAuthPluginConfig;
  lens?: LensAuthPluginConfig;
};

export type OrbLogin = Pick<
  AuthCapabilities,
  | "decodeToken"
  | "tokenExpiresWithin"
  | "isTokenExpired"
  | "getTokenExpiry"
  | "getSessionExpiry"
  | "isSessionStale"
  | "shouldRefreshSession"
> & {
  connectWithQr: QrAuthCapabilities["connectWithQr"];
  refresh: LensAuthCapabilities["refreshLensSession"];
  revoke: LensAuthCapabilities["revokeLensSession"];
  syncSession: LensAuthCapabilities["syncLensSession"];
  getAccountFromAccessToken: LensAuthCapabilities["getLensAccountFromAccessToken"];
};

export function createOrbLogin(config: OrbLoginConfig = {}): OrbLogin {
  const sdk = createSDK({
    fetch: config.fetch,
    logger: config.logger,
    runtime: config.runtime,
    defaults: config.defaults,
    plugins: [
      authPlugin({
        refreshUrl: DEFAULT_AUTH_REFRESH_URL,
        revokeUrl: DEFAULT_AUTH_REVOKE_URL,
      }),
      qrAuthPlugin({
        initUrl: DEFAULT_ORB_QR_INIT_URL,
        pollUrl: DEFAULT_ORB_QR_POLL_URL,
        credentials: DEFAULT_ORB_QR_CREDENTIALS,
        ...(config.qr ?? {}),
      }),
      lensAuthPlugin({
        graphqlUrl: DEFAULT_LENS_GRAPHQL_URL,
        ...(config.lens ?? {}),
      }),
    ],
  });

  return {
    decodeToken: sdk.auth.decodeToken,
    tokenExpiresWithin: sdk.auth.tokenExpiresWithin,
    isTokenExpired: sdk.auth.isTokenExpired,
    getTokenExpiry: sdk.auth.getTokenExpiry,
    getSessionExpiry: sdk.auth.getSessionExpiry,
    isSessionStale: sdk.auth.isSessionStale,
    shouldRefreshSession: sdk.auth.shouldRefreshSession,
    connectWithQr: sdk.auth.connectWithQr,
    refresh: sdk.auth.refreshLensSession,
    revoke: sdk.auth.revokeLensSession,
    syncSession: sdk.auth.syncLensSession,
    getAccountFromAccessToken: sdk.auth.getLensAccountFromAccessToken,
  };
}
