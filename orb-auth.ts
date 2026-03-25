/**
 * @module orb-auth
 *
 * QR-based authentication helpers plus Lens JWT token management.
 *
 * Client-side functions call local API route proxies rather than external
 * services directly from the browser.
 *
 * JWT utilities are pure functions with no network calls.
 *
 * @example
 *   import { initQrSignIn, pollQrSignIn, isTokenExpired, refreshTokens } from '@/modules/orb-auth'
 *
 *   // Start QR login
 *   const qr = await initQrSignIn()
 *   // Display qr.data?.data?.qrCode to the user
 *
 *   // Poll until authenticated
 *   const poll = await pollQrSignIn(secret)
 *   if (poll.data?.data?.accessToken) { // logged in }
 *
 *   // Check / refresh tokens
 *   if (isTokenExpired(accessToken)) {
 *     const fresh = await refreshTokens(refreshToken)
 *   }
 */

// =====================================================================
// JWT Utilities (pure, no network)
// =====================================================================

/** Decode a JWT without signature verification. Returns payload or null. */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** True if token expires within the given number of seconds. */
export function tokenExpiresWithin(token: string, seconds: number): boolean {
  const p = decodeJwt(token);
  if (!p || typeof p.exp !== "number") return true;
  return Date.now() >= p.exp * 1000 - seconds * 1000;
}

/** True if the token is expired (with optional buffer in seconds, default 30). */
export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  return tokenExpiresWithin(token, bufferSeconds);
}

/** Get the expiry time of a JWT as a Date, or null. */
export function getTokenExpiry(token: string): Date | null {
  const p = decodeJwt(token);
  if (!p || typeof p.exp !== "number") return null;
  return new Date(p.exp * 1000);
}

// =====================================================================
// Types
// =====================================================================

export interface AuthConfig {
  /** Base URL prefix for API route proxies. Default: '' (same origin). */
  apiBase?: string;
}

export interface QrInitResult {
  ok: boolean;
  message: string;
  data?: {
    status: string;
    data?: { qrCode: string; secret: string; deepLink?: string };
  };
}

export interface QrPollResult {
  ok: boolean;
  message: string;
  data?: {
    status: string;
    data?: {
      processed?: boolean;
      idToken?: string;
      accessToken?: string;
      refreshToken?: string;
      user_id?: string;
      handle?: string;
      source?: string;
    };
    profile?: {
      name: string | null;
      picture: string | null;
      bio: string | null;
      coverPicture: string | null;
      localName: string | null;
    };
  };
}

export interface RefreshResult {
  ok: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  error?: string;
}

export interface RevokeResult {
  ok: boolean;
  message: string;
}

export interface VerifyResult {
  ok: boolean;
  message: string;
  data?: {
    account: string | null;
    sponsored?: boolean;
    role?: string;
    rally?: string;
    app?: string;
    exp?: number;
    iat?: number;
  };
}

// =====================================================================
// Internal fetch helper
// =====================================================================

async function post<T>(path: string, body?: unknown, config?: AuthConfig): Promise<T> {
  const base = config?.apiBase ?? "";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  return json as T;
}

async function get<T>(path: string, config?: AuthConfig): Promise<T> {
  const base = config?.apiBase ?? "";
  const res = await fetch(`${base}${path}`);
  return (await res.json()) as T;
}

// =====================================================================
// QR Login
// =====================================================================

/**
 * Start a QR sign-in session.
 * Returns a QR code URL and secret for polling.
 *
 * Requires server route: GET /api/qr/init
 */
export async function initQrSignIn(config?: AuthConfig): Promise<QrInitResult> {
  try {
    const json = await get<{ message?: string; data?: QrInitResult["data"] }>(
      "/api/qr/init",
      config,
    );
    return { ok: true, message: json?.message ?? "QR sign-in started", data: json?.data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unexpected error" };
  }
}

/**
 * Poll a QR sign-in session for authentication tokens.
 *
 * Requires server route: POST /api/qr/poll
 */
export async function pollQrSignIn(secret: string, config?: AuthConfig): Promise<QrPollResult> {
  try {
    const json = await post<{ message?: string; data?: QrPollResult["data"] }>(
      "/api/qr/poll",
      { secret },
      config,
    );
    return { ok: true, message: json?.message ?? "QR status updated", data: json?.data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unexpected error" };
  }
}

// =====================================================================
// Token Management
// =====================================================================

/**
 * Refresh Lens authentication tokens.
 *
 * Requires server route: POST /api/auth/refresh
 */
export async function refreshTokens(
  refreshToken: string,
  config?: AuthConfig,
): Promise<RefreshResult> {
  try {
    const json = await post<RefreshResult>("/api/auth/refresh", { refreshToken }, config);
    if (!json.accessToken) {
      return { ok: false, message: json?.message ?? "Unable to refresh token", error: json?.error };
    }
    return {
      ok: true,
      message: json?.message ?? "Token refreshed",
      accessToken: json.accessToken,
      refreshToken: json.refreshToken,
      idToken: json.idToken,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unexpected error" };
  }
}

/**
 * Revoke an authentication session on Lens.
 *
 * Requires server route: POST /api/auth/revoke
 */
export async function revokeAuthentication(
  authenticationId: string,
  accessToken: string,
  config?: AuthConfig,
): Promise<RevokeResult> {
  try {
    const json = await post<RevokeResult>(
      "/api/auth/revoke",
      { authenticationId, accessToken },
      config,
    );
    return { ok: json?.ok ?? true, message: json?.message ?? "Authentication revoked" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unexpected error" };
  }
}

/**
 * Verify a Lens access token (cryptographic JWT validation).
 *
 * Requires server route: POST /api/auth/verify
 */
export async function verifyCredentials(
  accessToken: string,
  config?: AuthConfig,
): Promise<VerifyResult> {
  try {
    const json = await post<{ status?: string; message?: string; data?: VerifyResult["data"] }>(
      "/api/auth/verify",
      { accessToken },
      config,
    );
    if (json?.status !== "SUCCESS") {
      return { ok: false, message: json?.message ?? "Verification failed" };
    }
    return { ok: true, message: "Credentials verified", data: json?.data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unexpected error" };
  }
}

// =====================================================================
// Account lookup (direct Lens GraphQL)
// =====================================================================

export interface AccountProfile {
  address: string;
  name: string | null;
  picture: string | null;
  bio: string | null;
  coverPicture: string | null;
  localName: string | null;
}

/**
 * Fetch a Lens account by address from the Lens GraphQL API.
 * Public read-only query — no auth required, safe on client or server.
 */
export async function fetchAccountByAddress(
  address: string,
  lensApiUrl?: string,
): Promise<{ ok: boolean; message: string; data?: AccountProfile }> {
  const url = lensApiUrl ?? "https://api.lens.xyz/graphql";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query Account($request: AccountRequest!) {
          account(request: $request) {
            address
            metadata { name picture bio coverPicture }
            username { localName }
          }
        }`,
        variables: { request: { address } },
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    const account = (json?.data as Record<string, unknown>)?.account as
      | Record<string, unknown>
      | undefined;
    if (!account) {
      return { ok: false, message: "Account not found" };
    }
    const metadata = account.metadata as Record<string, unknown> | undefined;
    const username = account.username as Record<string, unknown> | undefined;
    return {
      ok: true,
      message: "Account found",
      data: {
        address: account.address as string,
        name: (metadata?.name as string | null) ?? null,
        picture: (metadata?.picture as string | null) ?? null,
        bio: (metadata?.bio as string | null) ?? null,
        coverPicture: (metadata?.coverPicture as string | null) ?? null,
        localName: (username?.localName as string | null) ?? null,
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Account lookup failed" };
  }
}

// =====================================================================
// Environment status check
// =====================================================================

export interface EnvStatusResult {
  apiBaseConfigured: boolean;
  orbAccessTokenConfigured: boolean;
}

/**
 * Check if required server-side env vars are configured.
 *
 * Requires server route: GET /api/env-status
 */
export async function fetchEnvStatus(config?: AuthConfig): Promise<EnvStatusResult> {
  return get<EnvStatusResult>("/api/env-status", config);
}
