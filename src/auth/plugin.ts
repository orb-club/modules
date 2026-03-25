import {
  getSessionExpiry,
  isSessionStale,
  refreshSession,
  revokeSession,
  shouldRefreshSession,
} from "./session";
import { decodeToken, getTokenExpiry, isTokenExpired, tokenExpiresWithin } from "./token";
import type { AuthPlugin, AuthPluginConfig } from "./types";

export function authPlugin(config: AuthPluginConfig): AuthPlugin {
  return {
    name: "auth",
    namespace: "auth",
    setup: (context) => ({
      decodeToken,
      tokenExpiresWithin,
      isTokenExpired,
      getTokenExpiry,
      getSessionExpiry,
      isSessionStale,
      shouldRefreshSession,
      refresh: (session, options) => refreshSession(context, config, session, options),
      revoke: (session, options) => revokeSession(context, config, session, options),
    }),
  };
}
