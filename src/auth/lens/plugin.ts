import { getLensAccountFromAccessToken, refreshLensSession, syncLensSession } from "./session";
import type { LensAuthPlugin, LensAuthPluginConfig } from "./types";

export function lensAuthPlugin(config: LensAuthPluginConfig): LensAuthPlugin {
  return {
    name: "auth-lens",
    namespace: "auth",
    extends: "auth",
    requires: ["auth"],
    setup: (context) => ({
      getLensAccountFromAccessToken,
      refreshLensSession: (input, options) => refreshLensSession(context, config, input, options),
      syncLensSession: (session, options) => syncLensSession(context, config, session, options),
    }),
  };
}
