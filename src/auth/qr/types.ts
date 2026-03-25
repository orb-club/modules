import type { SDKContext, SDKPlugin } from "../../core/types";
import type { AuthRequestOptions } from "../types";

export type QrRequestDescriptor = {
  url: string;
  init: RequestInit;
};

export type QrRequestHeaders = Record<string, string>;

export type QrRequestOptions = {
  endpoint: string;
  headers?: QrRequestHeaders;
  origin?: string;
  referer?: string;
};

export type CreateQrInitRequestOptions = QrRequestOptions & {
  credentials?: string;
};

export type CreateQrPollRequestOptions = QrRequestOptions & {
  secret: string;
};

export type ParsedQrInitResponse = Record<string, unknown> & {
  qrCode: string;
  secret: string;
  deepLink?: string;
  raw: Record<string, unknown>;
};

export type ParsedQrPollResponse = Record<string, unknown> & {
  status?: string;
  processed?: boolean;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  authenticationId?: string;
  raw: Record<string, unknown>;
};

export type QrConnectResult = ParsedQrPollResponse & {
  processed: true;
  accessToken: string;
  idToken: string;
};

export type QrConnectOptions = AuthRequestOptions & {
  credentials?: string;
  headers?: QrRequestHeaders;
  pollIntervalMs?: number;
  onInit?: (payload: ParsedQrInitResponse) => void | Promise<void>;
};

export type QrAuthPluginConfig = {
  initUrl?: string;
  pollUrl?: string;
  credentials?: string;
  headers?: QrRequestHeaders;
  pollIntervalMs?: number;
  timeoutMs?: number;
  initTimeoutMs?: number;
  pollTimeoutMs?: number;
  parseInitResponse?: (payload: unknown) => ParsedQrInitResponse;
  parsePollResponse?: (payload: unknown) => ParsedQrPollResponse;
};

export class QrAuthError extends Error {
  code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QrAuthError";
    this.code = code;
  }
}

export class QrRequestError extends QrAuthError {
  stage: "init" | "poll";
  status?: number;

  constructor(
    stage: "init" | "poll",
    message: string,
    options?: {
      code?: string;
      status?: number;
      cause?: unknown;
    },
  ) {
    super(message, options?.code ?? "QR_REQUEST_FAILED", { cause: options?.cause });
    this.name = "QrRequestError";
    this.stage = stage;
    this.status = options?.status;
  }
}

export class QrResponseError extends QrAuthError {
  stage: "init" | "poll";

  constructor(
    stage: "init" | "poll",
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message, options?.code ?? "QR_RESPONSE_INVALID", { cause: options?.cause });
    this.name = "QrResponseError";
    this.stage = stage;
  }
}

export class QrTimeoutError extends QrAuthError {
  constructor(message = "QR authentication timed out.", options?: ErrorOptions) {
    super(message, "QR_TIMEOUT", options);
    this.name = "QrTimeoutError";
  }
}

export class QrCancelledError extends QrAuthError {
  constructor(message = "QR authentication was cancelled.", options?: ErrorOptions) {
    super(message, "QR_CANCELLED", options);
    this.name = "QrCancelledError";
  }
}

export type QrAuthCapabilities = {
  connectWithQr: (options?: QrConnectOptions) => Promise<QrConnectResult>;
  createQrInitRequest: (options: CreateQrInitRequestOptions) => QrRequestDescriptor;
  createQrPollRequest: (options: CreateQrPollRequestOptions) => QrRequestDescriptor;
  parseQrInitResponse: (payload: unknown) => ParsedQrInitResponse;
  parseQrPollResponse: (payload: unknown) => ParsedQrPollResponse;
};

export type QrAuthPlugin = SDKPlugin<"auth", QrAuthCapabilities>;

export type QrAuthContext = SDKContext;
