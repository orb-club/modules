import { validatePluginCapabilities, validatePluginRegistration } from "./plugin-validation";
import { createSDKContext } from "./runtime";
import type { CreateSDKOptions, SDKCapabilities, SDKFromPlugins, SDKPlugin } from "./types";

type MutableSDK = Record<string, SDKCapabilities>;

export function createSDK<const TPlugins extends readonly SDKPlugin<string, SDKCapabilities>[]>(
  options: CreateSDKOptions<TPlugins>,
): SDKFromPlugins<TPlugins> {
  const sdk: MutableSDK = Object.create(null) as MutableSDK;
  const context = createSDKContext(options);
  const validationState = {
    installedNames: new Set<string>(),
    namespaceOwners: new Map<string, string>(),
    capabilityOwners: new Map<string, Map<string, string>>(),
  };

  for (const plugin of options.plugins) {
    validatePluginRegistration(plugin, validationState);

    const capabilities = validatePluginCapabilities(plugin, plugin.setup(context), validationState);
    let namespace = sdk[plugin.namespace];

    if (!namespace) {
      namespace = Object.create(null) as SDKCapabilities;
      sdk[plugin.namespace] = namespace;
    }

    Object.assign(namespace, capabilities);
  }

  return sdk as SDKFromPlugins<TPlugins>;
}
