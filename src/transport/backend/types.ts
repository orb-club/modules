import type { SDKContext, SDKPlugin } from "../../core/types";

export type BackendHeaderCredential = {
  header: string;
  value: string;
  prefix?: string;
};

export type BackendAccessTokenConfig = {
  header?: string;
  prefix?: string;
};

export type BackendTransportPluginConfig = {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  serviceCredential?: BackendHeaderCredential;
  accessToken?: BackendAccessTokenConfig;
};

export type BackendCallOptions = {
  method?: string;
  headers?: Record<string, string>;
  accessToken?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type BackendTransportCapabilities = {
  call: <TResponse = unknown>(
    path: string,
    payload?: unknown,
    options?: BackendCallOptions,
  ) => Promise<TResponse>;
};

export type BackendTransportPlugin = SDKPlugin<"transport", BackendTransportCapabilities>;

export type BackendTransportContext = SDKContext;
