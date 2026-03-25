import { callBackend } from "./client";
import type { BackendTransportPlugin, BackendTransportPluginConfig } from "./types";

export function backendTransportPlugin(
  config: BackendTransportPluginConfig,
): BackendTransportPlugin {
  return {
    name: "transport-backend",
    namespace: "transport",
    setup: (context) => ({
      call: (path, payload, options) => callBackend(context, config, path, payload, options),
    }),
  };
}
