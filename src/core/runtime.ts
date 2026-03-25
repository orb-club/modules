import { SDKConfigurationError } from "./errors";
import type { SDKContext, SDKDefaults, SDKFetch, SDKLogger, SDKRuntime } from "./types";

export type TimeoutHandle = {
  cancel: () => void;
  signal: AbortSignal | undefined;
  timeoutMs: number | undefined;
};

export function resolveFetch(fetchOverride?: SDKFetch): SDKFetch {
  if (fetchOverride) {
    return fetchOverride;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new SDKConfigurationError(
    "No fetch implementation is available. Pass createSDK({ fetch }) to provide one.",
  );
}

export function mergeAbortSignals(
  ...signals: Array<AbortSignal | null | undefined>
): AbortSignal | undefined {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));

  if (activeSignals.length === 0) {
    return undefined;
  }

  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const abort = (reason?: unknown) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }

    for (const [signal, listener] of listeners) {
      signal.removeEventListener("abort", listener);
    }

    listeners.clear();
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort(signal.reason);
      break;
    }

    const listener = () => abort(signal.reason);
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }

  return controller.signal;
}

export function createTimeoutSignal(timeoutMs?: number, signal?: AbortSignal): TimeoutHandle {
  if (typeof timeoutMs !== "number" || timeoutMs <= 0) {
    return {
      cancel: () => undefined,
      signal,
      timeoutMs,
    };
  }

  const controller = new AbortController();
  const mergedSignal = mergeAbortSignals(signal, controller.signal);
  const timer = globalThis.setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, timeoutMs);

  return {
    cancel: () => {
      globalThis.clearTimeout(timer);
    },
    signal: mergedSignal,
    timeoutMs,
  };
}

export function resolveTimeoutMs(
  defaults: SDKDefaults | undefined,
  timeoutMs?: number,
): number | undefined {
  return timeoutMs ?? defaults?.timeoutMs;
}

export function createSDKContext(options: {
  defaults?: SDKDefaults;
  fetch?: SDKFetch;
  logger?: SDKLogger;
  runtime?: SDKRuntime;
}): SDKContext {
  return {
    defaults: options.defaults,
    fetch: resolveFetch(options.fetch),
    logger: options.logger ?? {},
    runtime: options.runtime ?? "unknown",
    createTimeoutSignal: (timeoutMs, signal) =>
      createTimeoutSignal(resolveTimeoutMs(options.defaults, timeoutMs), signal),
    mergeAbortSignals,
  };
}
