export type SDKFetch = typeof globalThis.fetch;

export type SDKLogger = {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

export type SDKRuntime = "browser" | "server" | "edge" | "unknown";

export type SDKDefaults = {
  timeoutMs?: number;
};

export type SDKContext = {
  defaults?: SDKDefaults;
  fetch: SDKFetch;
  logger: SDKLogger;
  runtime: SDKRuntime;
  createTimeoutSignal: (
    timeoutMs?: number,
    signal?: AbortSignal,
  ) => {
    cancel: () => void;
    signal: AbortSignal | undefined;
    timeoutMs: number | undefined;
  };
  mergeAbortSignals: (...signals: Array<AbortSignal | null | undefined>) => AbortSignal | undefined;
};

export type SDKCapabilities = Record<string, unknown>;

export type SDKPlugin<TNamespace extends string, TCapabilities> = {
  name: string;
  namespace: TNamespace;
  extends?: TNamespace;
  requires?: string[];
  setup: (context: SDKContext) => TCapabilities;
};

export type SDKPluginNamespace<TPlugin extends SDKPlugin<string, unknown>> = TPlugin["namespace"];

export type SDKPluginCapabilities<TPlugin extends SDKPlugin<string, unknown>> =
  TPlugin extends SDKPlugin<string, infer TCapabilities> ? TCapabilities : never;

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer TIntersection,
) => void
  ? TIntersection
  : never;

type Simplify<T> = {
  [TKey in keyof T]: T[TKey];
} & {};

type NamespaceContribution<TPlugin extends SDKPlugin<string, unknown>> =
  TPlugin extends SDKPlugin<infer TNamespace, infer TCapabilities>
    ? {
        [TKey in TNamespace]: TCapabilities;
      }
    : never;

export type SDKFromPlugins<TPlugins extends readonly SDKPlugin<string, unknown>[]> = Simplify<
  UnionToIntersection<NamespaceContribution<TPlugins[number]>>
>;

export type CreateSDKOptions<
  TPlugins extends readonly SDKPlugin<string, SDKCapabilities>[] = readonly SDKPlugin<
    string,
    SDKCapabilities
  >[],
> = {
  plugins: TPlugins;
  fetch?: SDKFetch;
  logger?: SDKLogger;
  runtime?: SDKRuntime;
  defaults?: SDKDefaults;
};
