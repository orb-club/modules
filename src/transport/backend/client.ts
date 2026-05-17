import { BackendTransportConfigError, BackendTransportRequestError } from "./errors";
import type {
  BackendCallOptions,
  BackendTransportContext,
  BackendTransportPluginConfig,
} from "./types";

const DEFAULT_ACCESS_TOKEN_HEADER = "authorization";
const DEFAULT_METHOD = "POST";
const ABSOLUTE_OR_SCHEME_PATH_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  return fallback;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim();

  if (normalized.length === 0) {
    throw new BackendTransportConfigError("backendTransportPlugin requires a non-empty baseUrl.");
  }

  try {
    return new URL(normalized.endsWith("/") ? normalized : `${normalized}/`).toString();
  } catch (error) {
    throw new BackendTransportConfigError("backendTransportPlugin baseUrl must be a valid URL.", {
      cause: error,
    });
  }
}

function resolveUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.trim();

  if (normalizedPath.length === 0) {
    throw new BackendTransportConfigError("transport.call(path) requires a non-empty path.");
  }

  if (ABSOLUTE_OR_SCHEME_PATH_PATTERN.test(normalizedPath)) {
    throw new BackendTransportConfigError(
      "transport.call(path) only accepts relative paths when a baseUrl is configured.",
    );
  }

  const base = new URL(baseUrl);
  const url = new URL(normalizedPath.replace(/^\/+/, ""), base);

  if (!url.pathname.startsWith(base.pathname)) {
    throw new BackendTransportConfigError(
      "transport.call(path) cannot escape the configured baseUrl path.",
    );
  }

  return url.toString();
}

function assertHeaderName(header: string, fieldName: string): string {
  const normalized = header.trim();

  if (normalized.length === 0) {
    throw new BackendTransportConfigError(`${fieldName} must be a non-empty header name.`);
  }

  return normalized;
}

function setHeader(
  headers: Record<string, string>,
  header: string,
  value: string,
  fieldName: string,
): void {
  headers[assertHeaderName(header, fieldName).toLowerCase()] = value;
}

function buildHeaders(
  config: BackendTransportPluginConfig,
  options?: BackendCallOptions,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [header, value] of Object.entries(config.headers ?? {})) {
    setHeader(headers, header, value, "headers");
  }

  for (const [header, value] of Object.entries(options?.headers ?? {})) {
    setHeader(headers, header, value, "headers");
  }

  if (config.serviceCredential) {
    setHeader(
      headers,
      config.serviceCredential.header,
      `${config.serviceCredential.prefix ?? ""}${config.serviceCredential.value}`,
      "serviceCredential.header",
    );
  }

  if (options?.accessToken) {
    setHeader(
      headers,
      config.accessToken?.header ?? DEFAULT_ACCESS_TOKEN_HEADER,
      `${config.accessToken?.prefix ?? ""}${options.accessToken}`,
      "accessToken.header",
    );
  }

  return headers;
}

function resolveBody(payload: unknown): string | undefined {
  if (typeof payload === "undefined") {
    return undefined;
  }

  return JSON.stringify(payload);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json().catch(() => undefined);
  }

  const text = await response.text().catch(() => "");
  return text.length > 0 ? text : undefined;
}

function toRequestError(error: unknown, fallbackMessage: string): BackendTransportRequestError {
  if (error instanceof BackendTransportRequestError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new BackendTransportRequestError(fallbackMessage, {
      code: "BACKEND_TRANSPORT_TIMEOUT",
      cause: error,
    });
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new BackendTransportRequestError(fallbackMessage, {
      code: "BACKEND_TRANSPORT_ABORTED",
      cause: error,
    });
  }

  return new BackendTransportRequestError(fallbackMessage, {
    code: "BACKEND_TRANSPORT_REQUEST",
    cause: error,
  });
}

export async function callBackend<TResponse = unknown>(
  context: BackendTransportContext,
  config: BackendTransportPluginConfig,
  path: string,
  payload?: unknown,
  options?: BackendCallOptions,
): Promise<TResponse> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = resolveUrl(baseUrl, path);
  const timeoutHandle = context.createTimeoutSignal(
    options?.timeoutMs ?? config.timeoutMs,
    options?.signal,
  );

  try {
    const body = resolveBody(payload);
    const headers = buildHeaders(config, options);

    if (typeof body !== "undefined" && !("content-type" in headers)) {
      headers["content-type"] = "application/json";
    }

    const response = await context.fetch(url, {
      method: options?.method ?? DEFAULT_METHOD,
      headers,
      body,
      signal: timeoutHandle.signal,
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new BackendTransportRequestError(
        getErrorMessage(responseBody, "Backend transport request failed."),
        {
          status: response.status,
        },
      );
    }

    return responseBody as TResponse;
  } catch (error) {
    if (error instanceof BackendTransportConfigError) {
      throw error;
    }

    if (timeoutHandle.signal?.aborted) {
      throw toRequestError(timeoutHandle.signal.reason, "Backend transport request failed.");
    }

    throw toRequestError(error, "Backend transport request failed.");
  } finally {
    timeoutHandle.cancel();
  }
}
