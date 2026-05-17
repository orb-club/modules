import {
  createQrInitRequest,
  createQrPollRequest,
  parseQrInitResponse,
  parseQrPollResponse,
} from "./server";
import {
  type ParsedQrInitResponse,
  type ParsedQrPollResponse,
  type QrAuthContext,
  type QrAuthPluginConfig,
  QrCancelledError,
  type QrConnectOptions,
  type QrConnectResult,
  QrRequestError,
  QrResponseError,
  QrTimeoutError,
} from "./types";

const DEFAULT_INIT_URL = "/api/qr/init";
const DEFAULT_POLL_URL = "/api/qr/poll";
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 120000;

function isTimeoutReason(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === "TimeoutError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  if (isTimeoutReason(signal.reason)) {
    throw new QrTimeoutError(undefined, { cause: signal.reason });
  }

  throw new QrCancelledError(undefined, { cause: signal.reason });
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    throwIfAborted(signal);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();

      if (isTimeoutReason(signal?.reason)) {
        reject(new QrTimeoutError(undefined, { cause: signal?.reason }));
        return;
      }

      reject(new QrCancelledError(undefined, { cause: signal?.reason }));
    };

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);

  if (!signal) {
    return promise;
  }

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();

      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function normalizeStageError(stage: "init" | "poll", error: unknown): never {
  if (
    error instanceof QrRequestError ||
    error instanceof QrResponseError ||
    error instanceof QrTimeoutError ||
    error instanceof QrCancelledError
  ) {
    throw error;
  }

  throw new QrRequestError(stage, `QR ${stage} request failed.`, { cause: error });
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function fetchJson(
  context: QrAuthContext,
  stage: "init" | "poll",
  input: string | URL,
  init: RequestInit,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<unknown> {
  const requestTimeout = context.createTimeoutSignal(timeoutMs, signal);

  try {
    throwIfAborted(requestTimeout.signal);

    const response = await context.fetch(input, {
      ...init,
      signal: requestTimeout.signal,
    });

    if (!response.ok) {
      throw new QrRequestError(stage, `QR ${stage} request failed (${response.status}).`, {
        status: response.status,
      });
    }

    try {
      return await response.json();
    } catch (error) {
      throw new QrResponseError(stage, `QR ${stage} response was not valid JSON.`, {
        cause: error,
      });
    }
  } catch (error) {
    if (requestTimeout.signal?.aborted) {
      throwIfAborted(requestTimeout.signal);
    }

    normalizeStageError(stage, error);
  } finally {
    requestTimeout.cancel();
  }
}

function isSuccessfulPollResponse(payload: ParsedQrPollResponse): payload is QrConnectResult {
  return payload.processed === true && isNonBlankString(payload.accessToken);
}

function isTerminalPollResponse(payload: ParsedQrPollResponse): boolean {
  return payload.processed === true;
}

async function runInit(
  context: QrAuthContext,
  config: QrAuthPluginConfig,
  options: QrConnectOptions | undefined,
  signal?: AbortSignal,
): Promise<ParsedQrInitResponse> {
  const request = createQrInitRequest({
    endpoint: config.initUrl ?? DEFAULT_INIT_URL,
    credentials: options?.credentials ?? config.credentials,
    headers: {
      ...(config.headers ?? {}),
      ...(options?.headers ?? {}),
    },
  });
  const payload = await fetchJson(
    context,
    "init",
    request.url,
    request.init,
    signal,
    config.initTimeoutMs,
  );

  return (config.parseInitResponse ?? parseQrInitResponse)(payload);
}

async function runPoll(
  context: QrAuthContext,
  config: QrAuthPluginConfig,
  secret: string,
  options: QrConnectOptions | undefined,
  signal?: AbortSignal,
): Promise<ParsedQrPollResponse> {
  const request = createQrPollRequest({
    endpoint: config.pollUrl ?? DEFAULT_POLL_URL,
    secret,
    headers: {
      ...(config.headers ?? {}),
      ...(options?.headers ?? {}),
    },
  });
  const payload = await fetchJson(
    context,
    "poll",
    request.url,
    request.init,
    signal,
    config.pollTimeoutMs,
  );

  return (config.parsePollResponse ?? parseQrPollResponse)(payload);
}

export async function connectWithQr(
  context: QrAuthContext,
  config: QrAuthPluginConfig,
  options?: QrConnectOptions,
): Promise<QrConnectResult> {
  const resolvedTimeoutMs =
    options?.timeoutMs ?? config.timeoutMs ?? context.defaults?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = context.createTimeoutSignal(resolvedTimeoutMs, options?.signal);
  const pollIntervalMs =
    options?.pollIntervalMs ?? config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  try {
    const init = await runInit(context, config, options, timeout.signal);

    if (options?.onInit) {
      await awaitWithAbort(Promise.resolve(options.onInit(init)), timeout.signal);
    }

    while (true) {
      throwIfAborted(timeout.signal);

      const response = await runPoll(context, config, init.secret, options, timeout.signal);
      if (isSuccessfulPollResponse(response)) {
        return response;
      }

      if (response.status === "FAILED") {
        throw new QrRequestError("poll", "QR authentication failed.", {
          code: "QR_POLL_FAILED",
        });
      }

      if (isTerminalPollResponse(response)) {
        throw new QrResponseError(
          "poll",
          "QR poll response was terminal but did not include the required token data.",
        );
      }

      await delay(pollIntervalMs, timeout.signal);
    }
  } finally {
    timeout.cancel();
  }
}
