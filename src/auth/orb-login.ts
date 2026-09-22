import { createSDK } from "../core/create-sdk";
import type { CreateSDKOptions } from "../core/types";
import {
  DEFAULT_AUTH_REFRESH_URL,
  DEFAULT_AUTH_REVOKE_URL,
  DEFAULT_LENS_GRAPHQL_URL,
} from "./defaults";
import { watchSessionExpiry } from "./expiry";
import { lensAuthPlugin } from "./lens/plugin";
import type { LensAuthCapabilities, LensAuthPluginConfig } from "./lens/types";
import { authPlugin } from "./plugin";
import { prefersDeepLink } from "./qr/client";
import { qrAuthPlugin } from "./qr/plugin";
import type {
  QrAuthPluginConfig,
  QrConnectOptions,
  QrConnectResult,
  QrSignInApproval,
} from "./qr/types";
import type { AuthCapabilities } from "./types";
import { AuthSessionError } from "./types";

type OrbLoginSDKOptions = Omit<CreateSDKOptions, "plugins">;

export type OrbLoginConfig = OrbLoginSDKOptions & {
  qr?: QrAuthPluginConfig;
  lens?: LensAuthPluginConfig;
};

/** What `onInit` receives: display-only approval data. */
export type OrbLoginQrInit = QrSignInApproval;

export type OrbLoginQrOptions = QrConnectOptions;

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
  /** Runs browser-site Sign in with Orb in the page. Resolves with id + access tokens; never a refresh token. */
  connectWithQr: (options?: OrbLoginQrOptions) => Promise<QrConnectResult>;
  /** True on touch-first devices: show an "Open Orb app" link to `deepLink` next to the QR. */
  prefersDeepLink: typeof prefersDeepLink;
  /** Calls back once when the session's access token expires; returns a stop function. */
  watchSessionExpiry: typeof watchSessionExpiry;
  /**
   * @deprecated Sign in with Orb issues no refresh token, so there is nothing
   * to refresh. Always rejects with `AuthSessionError` (`AUTH_REFRESH_UNSUPPORTED`).
   * End the session when the access token expires and prompt a new sign-in.
   */
  refresh: (..._args: unknown[]) => Promise<never>;
  revoke: LensAuthCapabilities["revokeLensSession"];
  /** Returns the session while its access token is valid, otherwise `null`. */
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
      qrAuthPlugin(config.qr ?? {}),
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
    connectWithQr: (options) => {
      const { onInit, ...rest } = options ?? {};
      return sdk.auth.connectWithQr({
        ...rest,
        // Hand the UI a fresh object holding only the display fields.
        ...(onInit
          ? {
              onInit: ({ qrCode, deepLink, expiresAt }) => onInit({ qrCode, deepLink, expiresAt }),
            }
          : {}),
      });
    },
    prefersDeepLink,
    watchSessionExpiry,
    refresh: () =>
      Promise.reject(
        new AuthSessionError(
          "Sign in with Orb issues no refresh token. End the session when the access token expires and sign in again.",
          "refresh",
          "AUTH_REFRESH_UNSUPPORTED",
        ),
      ),
    revoke: sdk.auth.revokeLensSession,
    syncSession: sdk.auth.syncLensSession,
    getAccountFromAccessToken: sdk.auth.getLensAccountFromAccessToken,
  };
}
