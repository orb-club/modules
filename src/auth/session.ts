import { postJson } from "./http";
import { getTokenExpiry, tokenExpiresWithin } from "./token";
import type {
  AuthContext,
  AuthPluginConfig,
  AuthRequestOptions,
  AuthSession,
  RefreshSessionInput,
  RefreshSessionResult,
  RevokeSessionInput,
  RevokeSessionResult,
  SessionTimestampMs,
} from "./types";
import { AuthRequestError, AuthSessionError } from "./types";

function resolveTimestampMs(value: SessionTimestampMs | undefined): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

export function getSessionExpiry(session: AuthSession): Date | null {
  if (!session.accessToken) {
    return null;
  }

  return getTokenExpiry(session.accessToken);
}

export function isSessionStale(session: AuthSession, maxAgeMs: number): boolean {
  const timestamp =
    resolveTimestampMs(session.updatedAtMs) ?? resolveTimestampMs(session.createdAtMs);

  if (timestamp === null) {
    return true;
  }

  return Date.now() - timestamp >= maxAgeMs;
}

export function shouldRefreshSession(session: AuthSession, refreshWindowSeconds: number): boolean {
  if (!session.refreshToken) {
    return false;
  }

  if (!session.accessToken) {
    return true;
  }

  return tokenExpiresWithin(session.accessToken, refreshWindowSeconds);
}

export async function refreshSession(
  context: AuthContext,
  config: AuthPluginConfig,
  session: RefreshSessionInput,
  options?: AuthRequestOptions,
): Promise<RefreshSessionResult> {
  if (!session.refreshToken) {
    throw new AuthSessionError("A refreshToken is required to refresh a session.", "refresh");
  }

  const result = await postJson<RefreshSessionResult>(
    context,
    config,
    "refresh",
    config.refreshUrl,
    {
      refreshToken: session.refreshToken,
      ...(session.authenticationId ? { authenticationId: session.authenticationId } : {}),
    },
    options,
  );

  if (typeof result.accessToken !== "string" || result.accessToken.length === 0) {
    throw new AuthRequestError("refresh response did not include an accessToken", "refresh");
  }

  return result;
}

export async function revokeSession(
  context: AuthContext,
  config: AuthPluginConfig,
  session: RevokeSessionInput,
  options?: AuthRequestOptions,
): Promise<RevokeSessionResult> {
  if (!session.authenticationId) {
    throw new AuthSessionError("An authenticationId is required to revoke a session.", "revoke");
  }

  if (!session.accessToken) {
    throw new AuthSessionError("An accessToken is required to revoke a session.", "revoke");
  }

  return postJson<RevokeSessionResult>(
    context,
    config,
    "revoke",
    config.revokeUrl,
    {
      authenticationId: session.authenticationId,
      accessToken: session.accessToken,
    },
    options,
  );
}
