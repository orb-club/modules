import type { SDKContext, SDKPlugin } from "../core/types";

export type TokenPayload = Record<string, unknown> & {
  exp?: number;
  iat?: number;
};

export type SessionTimestampMs = Date | number;

export type AuthSession = {
  accessToken?: string;
  refreshToken?: string;
  authenticationId?: string;
  idToken?: string;
  createdAtMs?: SessionTimestampMs;
  updatedAtMs?: SessionTimestampMs;
};

export type AuthRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type AuthPluginConfig = {
  refreshUrl: string;
  revokeUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type RefreshSessionInput = {
  refreshToken: string;
  authenticationId?: string;
};

export type RefreshSessionResult = {
  accessToken: string;
  refreshToken?: string;
  authenticationId?: string;
  idToken?: string;
} & Record<string, unknown>;

export type RevokeSessionInput = {
  authenticationId: string;
  accessToken: string;
};

export type RevokeSessionResult = Record<string, unknown>;

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthError";
    this.code = code;
  }
}

export class AuthSessionError extends AuthError {
  operation: "refresh" | "revoke";

  constructor(
    message: string,
    operation: "refresh" | "revoke",
    code = "AUTH_SESSION_INVALID",
    options?: ErrorOptions,
  ) {
    super(message, code, options);
    this.name = "AuthSessionError";
    this.operation = operation;
  }
}

export class AuthRequestError extends AuthError {
  operation: "refresh" | "revoke";
  status?: number;

  constructor(
    message: string,
    operation: "refresh" | "revoke",
    options?: {
      code?: string;
      cause?: unknown;
      status?: number;
    },
  ) {
    super(message, options?.code ?? "AUTH_REQUEST_FAILED", {
      cause: options?.cause,
    });
    this.name = "AuthRequestError";
    this.operation = operation;
    this.status = options?.status;
  }
}

export type AuthCapabilities = {
  decodeToken: (token: string) => TokenPayload | null;
  tokenExpiresWithin: (token: string, seconds: number) => boolean;
  isTokenExpired: (token: string, bufferSeconds?: number) => boolean;
  getTokenExpiry: (token: string) => Date | null;
  getSessionExpiry: (session: AuthSession) => Date | null;
  isSessionStale: (session: AuthSession, maxAgeMs: number) => boolean;
  shouldRefreshSession: (session: AuthSession, refreshWindowSeconds: number) => boolean;
  refresh: (
    session: RefreshSessionInput,
    options?: AuthRequestOptions,
  ) => Promise<RefreshSessionResult>;
  revoke: (
    session: RevokeSessionInput,
    options?: AuthRequestOptions,
  ) => Promise<RevokeSessionResult>;
};

export type AuthPlugin = SDKPlugin<"auth", AuthCapabilities>;

export type AuthContext = SDKContext;
