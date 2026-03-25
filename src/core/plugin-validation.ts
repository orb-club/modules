import { SDKConfigurationError, SDKPluginCollisionError } from "./errors";
import type { SDKCapabilities, SDKPlugin } from "./types";

type ValidationState = {
  installedNames: Set<string>;
  namespaceOwners: Map<string, string>;
  capabilityOwners: Map<string, Map<string, string>>;
};

function isRecord(value: unknown): value is SDKCapabilities {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePluginRegistration(
  plugin: SDKPlugin<string, unknown>,
  state: ValidationState,
): void {
  if (state.installedNames.has(plugin.name)) {
    throw new SDKConfigurationError(`Plugin "${plugin.name}" is already installed.`, plugin.name);
  }

  for (const requirement of plugin.requires ?? []) {
    if (!state.installedNames.has(requirement)) {
      throw new SDKConfigurationError(
        `Plugin "${plugin.name}" requires "${requirement}" to be installed earlier in the plugins array.`,
        plugin.name,
      );
    }
  }

  if (plugin.extends) {
    if (plugin.extends !== plugin.namespace) {
      throw new SDKConfigurationError(
        `Plugin "${plugin.name}" must use the same namespace for "namespace" and "extends".`,
        plugin.name,
      );
    }

    if (!state.namespaceOwners.has(plugin.extends)) {
      throw new SDKConfigurationError(
        `Plugin "${plugin.name}" cannot extend namespace "${plugin.extends}" before it exists.`,
        plugin.name,
      );
    }

    return;
  }

  if (state.namespaceOwners.has(plugin.namespace)) {
    throw new SDKConfigurationError(
      `Plugin "${plugin.name}" cannot create namespace "${plugin.namespace}" because it already exists. Declare "extends" to add capabilities.`,
      plugin.name,
    );
  }
}

export function validatePluginCapabilities(
  plugin: SDKPlugin<string, unknown>,
  capabilities: unknown,
  state: ValidationState,
): SDKCapabilities {
  if (!isRecord(capabilities)) {
    throw new SDKConfigurationError(
      `Plugin "${plugin.name}" must return an object from setup().`,
      plugin.name,
    );
  }

  const knownCapabilityOwners =
    state.capabilityOwners.get(plugin.namespace) ?? new Map<string, string>();

  for (const capabilityKey of Object.keys(capabilities)) {
    const existingPluginName = knownCapabilityOwners.get(capabilityKey);

    if (existingPluginName) {
      throw new SDKPluginCollisionError({
        namespace: plugin.namespace,
        capabilityKey,
        existingPluginName,
        incomingPluginName: plugin.name,
      });
    }
  }

  for (const capabilityKey of Object.keys(capabilities)) {
    knownCapabilityOwners.set(capabilityKey, plugin.name);
  }

  state.capabilityOwners.set(plugin.namespace, knownCapabilityOwners);

  if (!state.namespaceOwners.has(plugin.namespace)) {
    state.namespaceOwners.set(plugin.namespace, plugin.name);
  }

  state.installedNames.add(plugin.name);

  return capabilities;
}
