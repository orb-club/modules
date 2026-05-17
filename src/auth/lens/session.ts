import type { SDKContext } from "../../core/types";
import { shouldRefreshSession } from "../session";
import { decodeToken, isTokenExpired } from "../token";
import { AuthRequestError, AuthSessionError } from "../types";
import type {
  LensAuthPluginConfig,
  LensRefreshSessionInput,
  LensRefreshSessionResult,
  LensSession,
  LensSyncSessionOptions,
} from "./types";
import { LensAuthForbiddenError } from "./types";

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function getGraphQLErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) {
    return null;
  }

  const firstError = payload.errors.find(isRecord);
  return typeof firstError?.message === "string" ? firstError.message : "Lens refresh failed";
}

function withDerivedAccount(session: LensSession): LensSession {
  const account =
    session.account ?? getLensAccountFromAccessToken(session.accessToken) ?? undefined;
  return {
    ...session,
    ...(account ? { account } : {}),
  };
}

export function getLensAccountFromAccessToken(token?: string): string | null {
  if (!token) {
    return null;
  }

  const payload = decodeToken(token);
  if (!payload) {
    return null;
  }

  const act = payload.act;
  if (isRecord(act) && typeof act.sub === "string") {
    return act.sub;
  }

  return typeof payload.sub === "string" ? payload.sub : null;
}

export async function refreshLensSession(
  context: SDKContext,
  config: LensAuthPluginConfig,
  input: LensRefreshSessionInput,
  options?: LensSyncSessionOptions,
): Promise<LensRefreshSessionResult> {
  if (!input.refreshToken) {
    throw new AuthSessionError("A refreshToken is required to refresh a Lens session.", "refresh");
  }

  const timeout = context.createTimeoutSignal(
    options?.timeoutMs ?? config.timeoutMs,
    options?.signal,
  );

  try {
    const response = await context.fetch(config.graphqlUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.headers ?? {}),
      },
      body: JSON.stringify({
        query: `
          mutation Refresh($request: RefreshRequest!) {
            refresh(request: $request) {
              ... on AuthenticationTokens {
                __typename
                accessToken
                refreshToken
                idToken
              }
              ... on ForbiddenError {
                __typename
                reason
              }
            }
          }
        `,
        variables: {
          request: {
            refreshToken: input.refreshToken,
          },
        },
      }),
      signal: timeout.signal,
    });

    const payload = (await response.json().catch(() => undefined)) as unknown;
    const graphQLError = getGraphQLErrorMessage(payload);
    if (graphQLError) {
      throw new AuthRequestError(graphQLError, "refresh", {
        status: response.ok ? 400 : response.status,
      });
    }

    if (!response.ok) {
      throw new AuthRequestError("Lens refresh request failed", "refresh", {
        status: response.status,
      });
    }

    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : undefined;
    const result = data && isRecord(data.refresh) ? data.refresh : undefined;

    if (result?.__typename === "ForbiddenError") {
      throw new LensAuthForbiddenError(
        typeof result.reason === "string" ? result.reason : undefined,
      );
    }

    if (result?.__typename !== "AuthenticationTokens" || !isNonEmptyString(result.accessToken)) {
      throw new AuthRequestError(
        "Lens refresh response did not include an access token",
        "refresh",
      );
    }

    return {
      accessToken: result.accessToken,
      ...(typeof result.refreshToken === "string" ? { refreshToken: result.refreshToken } : {}),
      ...(typeof result.idToken === "string" ? { idToken: result.idToken } : {}),
    };
  } catch (error) {
    if (error instanceof AuthRequestError || error instanceof LensAuthForbiddenError) {
      throw error;
    }

    throw new AuthRequestError("Lens refresh request failed", "refresh", {
      cause: error,
    });
  } finally {
    timeout.cancel();
  }
}

export async function syncLensSession(
  context: SDKContext,
  config: LensAuthPluginConfig,
  session: LensSession | null,
  options?: LensSyncSessionOptions,
): Promise<LensSession | null> {
  if (!session) {
    return null;
  }

  const hydrated = withDerivedAccount(session);
  const refreshWindowSeconds = options?.refreshWindowSeconds ?? 60;

  if (hydrated.accessToken && !shouldRefreshSession(hydrated, refreshWindowSeconds)) {
    return hydrated;
  }

  if (!hydrated.refreshToken) {
    return hydrated.accessToken && !isTokenExpired(hydrated.accessToken) ? hydrated : null;
  }

  try {
    const refreshed = await refreshLensSession(
      context,
      config,
      { refreshToken: hydrated.refreshToken },
      options,
    );

    return withDerivedAccount({
      ...hydrated,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? hydrated.refreshToken,
      idToken: refreshed.idToken ?? hydrated.idToken,
    });
  } catch (error) {
    if (error instanceof LensAuthForbiddenError) {
      return null;
    }

    return hydrated;
  }
}
