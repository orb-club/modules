export class SDKError extends Error {
  readonly code: string;

  constructor(message: string, code = "SDK_ERROR") {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class SDKConfigurationError extends SDKError {
  readonly pluginName?: string;

  constructor(message: string, pluginName?: string, code = "SDK_CONFIGURATION_ERROR") {
    super(message, code);
    this.pluginName = pluginName;
  }
}

export class SDKPluginCollisionError extends SDKConfigurationError {
  readonly namespace: string;
  readonly capabilityKey: string;
  readonly existingPluginName: string;
  readonly incomingPluginName: string;

  constructor(options: {
    namespace: string;
    capabilityKey: string;
    existingPluginName: string;
    incomingPluginName: string;
  }) {
    super(
      `Plugin "${options.incomingPluginName}" cannot define "${options.namespace}.${options.capabilityKey}" because it is already provided by "${options.existingPluginName}".`,
      options.incomingPluginName,
      "SDK_PLUGIN_COLLISION",
    );
    this.namespace = options.namespace;
    this.capabilityKey = options.capabilityKey;
    this.existingPluginName = options.existingPluginName;
    this.incomingPluginName = options.incomingPluginName;
  }
}
