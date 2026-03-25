import {
  type CreateQrInitRequestOptions,
  type CreateQrPollRequestOptions,
  type ParsedQrInitResponse,
  type ParsedQrPollResponse,
  type QrRequestDescriptor,
  QrRequestError,
  type QrRequestHeaders,
  QrResponseError,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown, stage: "init" | "poll"): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new QrResponseError(stage, `Invalid QR ${stage} response payload.`);
  }

  return value;
}

function getNestedData(payload: Record<string, unknown>): Record<string, unknown> {
  const first = isRecord(payload.data) ? payload.data : undefined;
  const second = first && isRecord(first.data) ? first.data : undefined;

  return second ?? first ?? payload;
}

function getStatus(payload: Record<string, unknown>): string | undefined {
  const first = isRecord(payload.data) ? payload.data : undefined;
  const second = first && isRecord(first.data) ? first.data : undefined;

  if (typeof payload.status === "string") {
    return payload.status;
  }

  if (typeof first?.status === "string") {
    return first.status;
  }

  if (typeof second?.status === "string") {
    return second.status;
  }

  return undefined;
}

function deriveOriginFromReferer(referer?: string): string | undefined {
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

function buildHeaders(
  headers: QrRequestHeaders | undefined,
  origin?: string,
  referer?: string,
): QrRequestHeaders | undefined {
  const resolvedOrigin = origin ?? deriveOriginFromReferer(referer);
  const resolvedReferer = referer ?? resolvedOrigin;
  const nextHeaders: QrRequestHeaders = {
    ...(headers ?? {}),
  };

  if (resolvedOrigin) {
    nextHeaders.origin = resolvedOrigin;
  }

  if (resolvedReferer) {
    nextHeaders.referer = resolvedReferer;
  }

  return Object.keys(nextHeaders).length > 0 ? nextHeaders : undefined;
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function appendQueryParam(endpoint: string, key: string, value: string): string {
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function withQueryParam(endpoint: string, key: string, value: string): string {
  if (!value) {
    return endpoint;
  }

  if (!isAbsoluteUrl(endpoint)) {
    return appendQueryParam(endpoint, key, value);
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set(key, value);
    return url.toString();
  } catch (error) {
    throw new QrRequestError("init", "QR init endpoint is invalid.", {
      code: "QR_REQUEST_INVALID",
      cause: error,
    });
  }
}

export function createQrInitRequest(options: CreateQrInitRequestOptions): QrRequestDescriptor {
  return {
    url: withQueryParam(options.endpoint, "credentials", options.credentials ?? ""),
    init: {
      method: "GET",
      headers: buildHeaders(options.headers, options.origin, options.referer),
    },
  };
}

export function createQrPollRequest(options: CreateQrPollRequestOptions): QrRequestDescriptor {
  return {
    url: options.endpoint,
    init: {
      method: "POST",
      headers: buildHeaders(
        {
          "content-type": "application/json",
          ...(options.headers ?? {}),
        },
        options.origin,
        options.referer,
      ),
      body: JSON.stringify({ secret: options.secret }),
    },
  };
}

export function parseQrInitResponse(payload: unknown): ParsedQrInitResponse {
  const raw = toRecord(payload, "init");
  const data = getNestedData(raw);
  const qrCode = typeof data.qrCode === "string" ? data.qrCode : undefined;
  const secret = typeof data.secret === "string" ? data.secret : undefined;
  const deepLink = typeof data.deepLink === "string" ? data.deepLink : undefined;

  if (!qrCode || !secret) {
    throw new QrResponseError("init", "QR init response did not include qrCode and secret.");
  }

  return {
    ...data,
    qrCode,
    secret,
    ...(deepLink ? { deepLink } : {}),
    raw,
  };
}

export function parseQrPollResponse(payload: unknown): ParsedQrPollResponse {
  const raw = toRecord(payload, "poll");
  const data = getNestedData(raw);
  const status = getStatus(raw);
  const processed = typeof data.processed === "boolean" ? data.processed : undefined;
  const accessToken = typeof data.accessToken === "string" ? data.accessToken : undefined;
  const idToken = typeof data.idToken === "string" ? data.idToken : undefined;
  const refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : undefined;
  const authenticationId =
    typeof data.authenticationId === "string" ? data.authenticationId : undefined;

  return {
    ...data,
    ...(status ? { status } : {}),
    ...(typeof processed === "boolean" ? { processed } : {}),
    ...(accessToken ? { accessToken } : {}),
    ...(idToken ? { idToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(authenticationId ? { authenticationId } : {}),
    raw,
  };
}
