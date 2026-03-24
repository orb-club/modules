/**
 * @module adapters/hono
 *
 * Hono route handler factories that proxy requests to the Orb backend.
 *
 * @example
 *   import { Hono } from 'hono'
 *   import { createOrbRoute, createQrInitRoute, createQrPollRoute } from '@orb-club/modules/adapters/hono'
 *
 *   const app = new Hono()
 *   app.post('/api/user', createOrbRoute('MAINNET-QUERIES/get-user'))
 *   app.get('/api/qr/init', createQrInitRoute())
 *   app.post('/api/qr/poll', createQrPollRoute())
 */

import type { Context } from "hono";
import {
  DEFAULT_ORIGIN,
  LENS_API_URL,
  POST_BY_TX_QUERY,
  QR_API_URL,
  REFRESH_MUTATION,
  REVOKE_MUTATION,
} from "../constants";

// =====================================================================
// Configuration
// =====================================================================

export interface OrbProxyConfig {
  /** Orb backend base URL. Reads from API_BASE_URL env var by default. */
  backendBaseUrl?: string;
  /** Server-side Orb access token. Reads from ORB_ACCESS_TOKEN env var by default. */
  orbAccessToken?: string;
}

export interface RouteOptions {
  /** Transform the request body before forwarding. */
  transformRequest?: (body: Record<string, unknown>) => Record<string, unknown>;
  /** Transform the backend response before returning to the client. */
  transformResponse?: (data: Record<string, unknown>) => Record<string, unknown>;
  /** Override global proxy config for this route. */
  config?: OrbProxyConfig;
}

// =====================================================================
// Orb backend proxy
// =====================================================================

/**
 * Create a Hono POST route handler that proxies to the Orb backend.
 *
 * The client sends: `{ xAccessToken, ...params }`
 * The proxy forwards `params` to `API_BASE_URL/<backendPath>` with headers:
 *   - `x-access-token: Bearer <xAccessToken>`
 *   - `orb-access-token: Bearer <ORB_ACCESS_TOKEN>`
 */
export function createOrbRoute(backendPath: string, options?: RouteOptions) {
  return async (c: Context) => {
    const apiBase = options?.config?.backendBaseUrl ?? process.env.API_BASE_URL;
    const orbToken = options?.config?.orbAccessToken ?? process.env.ORB_ACCESS_TOKEN;

    if (!apiBase || !orbToken) {
      return c.json(
        { message: "Server misconfigured: missing API_BASE_URL or ORB_ACCESS_TOKEN" },
        500,
      );
    }

    try {
      const body = await c.req.json();
      const { xAccessToken, ...rest } = body;

      let payload: Record<string, unknown> = rest;
      if (options?.transformRequest) {
        payload = options.transformRequest(payload);
      }

      const response = await fetch(`${apiBase}/${backendPath}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(xAccessToken ? { "x-access-token": `Bearer ${xAccessToken}` } : {}),
          "orb-access-token": `Bearer ${orbToken}`,
        },
        body: JSON.stringify(payload),
      });

      let data = await response.json();

      if (options?.transformResponse) {
        data = options.transformResponse(data as Record<string, unknown>);
      }

      if ((data as Record<string, unknown>)?.status === "FAILED") {
        return c.json(data, 400);
      }

      return c.json(data);
    } catch (error) {
      console.error(`[orb-proxy ${backendPath}]`, error);
      return c.json({ message: error instanceof Error ? error.message : "Proxy error" }, 500);
    }
  };
}

// =====================================================================
// QR auth factories
// =====================================================================

export interface QrRouteConfig {
  /** QR API base URL. */
  qrApiUrl?: string;
}

function getOrigin(c: Context): string {
  return (
    c.req.header("origin") ??
    c.req.header("referer")?.replace(/\/$/, "") ??
    process.env.ORB_APP_ORIGIN ??
    DEFAULT_ORIGIN
  );
}

/**
 * Create a GET route that initializes a QR sign-in session.
 *
 * @param credentials - 'id' | 'id_access' | 'id_access_refresh'. Default: 'id_access'
 */
export function createQrInitRoute(credentials = "id_access", config?: QrRouteConfig) {
  const qrApi = config?.qrApiUrl ?? process.env.ORB_QR_BASE_URL ?? QR_API_URL;
  return async (c: Context) => {
    try {
      const origin = getOrigin(c);
      const response = await fetch(`${qrApi}/init-sign-in?credentials=${credentials}`, {
        headers: { origin, referer: origin },
      });
      if (!response.ok) {
        return c.json(
          { message: `QR init failed (${response.status})` },
          response.status as 400 | 500,
        );
      }
      const data = await response.json();
      return c.json({ message: "QR init", data });
    } catch (error) {
      return c.json({ message: error instanceof Error ? error.message : "QR init failed" }, 500);
    }
  };
}

export interface QrPollRouteConfig extends QrRouteConfig {
  /** Fetch user profile on successful login. Default: true. */
  enrichProfile?: boolean;
  /** Called server-side after successful QR login. Use for session creation, cookie setting, etc. */
  onSuccess?: (ctx: {
    pollData: Record<string, unknown>;
    profile: {
      name: string | null;
      picture: string | null;
      bio: string | null;
      coverPicture: string | null;
      localName: string | null;
    } | null;
    c: Context;
  }) => Promise<void> | void;
}

/**
 * Create a POST route that polls a QR sign-in session.
 * Enriches with user profile on success (default). Supports `onSuccess` hook
 * for server-side session creation.
 */
export function createQrPollRoute(config?: QrPollRouteConfig) {
  const qrApi = config?.qrApiUrl ?? process.env.ORB_QR_BASE_URL ?? QR_API_URL;
  return async (c: Context) => {
    try {
      const { secret } = await c.req.json();
      if (!secret) {
        return c.json({ message: "Secret is required" }, 400);
      }
      const origin = getOrigin(c);
      const response = await fetch(`${qrApi}/poll-sign-in`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          referer: origin,
        },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) {
        return c.json(
          { message: `QR poll failed (${response.status})` },
          response.status as 400 | 500,
        );
      }
      const data = await response.json();

      // On successful login: enrich profile + call onSuccess hook
      const pollData = (data as Record<string, unknown>)?.data as
        | Record<string, unknown>
        | undefined;
      if (
        (data as Record<string, unknown>)?.status === "SUCCESS" &&
        pollData?.processed === true &&
        pollData?.accessToken
      ) {
        let profile: Awaited<ReturnType<typeof fetchUserProfile>> = null;
        if (config?.enrichProfile !== false) {
          profile = await fetchUserProfile(pollData.accessToken as string);
          if (profile) {
            (data as Record<string, unknown>).profile = profile;
          }
        }

        if (config?.onSuccess) {
          await config.onSuccess({ pollData, profile, c });
        }
      }

      return c.json({ message: "QR poll", data });
    } catch (error) {
      return c.json({ message: error instanceof Error ? error.message : "QR poll failed" }, 500);
    }
  };
}

// =====================================================================
// Lens GraphQL factories
// =====================================================================

export interface LensRouteConfig {
  /** Lens GraphQL API URL. */
  lensApiUrl?: string;
}

/**
 * Create a POST route that refreshes Lens authentication tokens.
 */
export function createAuthRefreshRoute(config?: LensRouteConfig) {
  const lensApi = config?.lensApiUrl ?? LENS_API_URL;
  return async (c: Context) => {
    try {
      const { refreshToken } = await c.req.json();
      if (!refreshToken) {
        return c.json({ message: "refreshToken is required" }, 400);
      }

      const response = await fetch(lensApi, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: REFRESH_MUTATION,
          variables: { request: { refreshToken } },
        }),
      });

      const json = (await response.json()) as Record<string, unknown>;
      const result = ((json?.data as Record<string, unknown>)?.refresh ?? undefined) as
        | Record<string, unknown>
        | undefined;

      if (result?.reason) {
        return c.json({ message: result.reason, error: "FORBIDDEN" }, 403);
      }

      if (result?.accessToken) {
        return c.json({
          message: "Token refreshed",
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          idToken: result.idToken,
        });
      }

      return c.json({ message: "Unexpected response from Lens API" }, 500);
    } catch (error) {
      return c.json({ message: error instanceof Error ? error.message : "Refresh failed" }, 500);
    }
  };
}

/**
 * Create a POST route that revokes a Lens authentication session.
 */
export function createAuthRevokeRoute(config?: LensRouteConfig) {
  const lensApi = config?.lensApiUrl ?? LENS_API_URL;
  return async (c: Context) => {
    try {
      const { authenticationId, accessToken } = await c.req.json();
      if (!authenticationId || !accessToken) {
        return c.json({ message: "authenticationId and accessToken are required" }, 400);
      }

      const response = await fetch(lensApi, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-access-token": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: REVOKE_MUTATION,
          variables: { request: { authenticationId } },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return c.json(
          { message: text || "Failed to revoke" },
          response.status as 400 | 401 | 403 | 404 | 500,
        );
      }

      return c.json({ message: "Authentication revoked", success: true });
    } catch (error) {
      return c.json({ message: error instanceof Error ? error.message : "Revoke failed" }, 500);
    }
  };
}

/**
 * Create a POST route that fetches a post slug from a Lens tx hash.
 */
export function createPostByTxRoute(config?: LensRouteConfig) {
  const lensApi = config?.lensApiUrl ?? LENS_API_URL;
  return async (c: Context) => {
    try {
      const { txHash } = await c.req.json();
      if (!txHash) {
        return c.json({ message: "txHash is required", slug: null }, 400);
      }

      const response = await fetch(lensApi, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: POST_BY_TX_QUERY,
          variables: { txHash },
        }),
      });

      const json = (await response.json()) as Record<string, unknown>;
      const slug =
        (((json?.data as Record<string, unknown>)?.post as Record<string, unknown> | undefined)
          ?.slug as string | null) ?? null;
      return c.json({ message: slug ? "Slug found" : "No slug yet", slug });
    } catch (error) {
      return c.json(
        { message: error instanceof Error ? error.message : "Lookup failed", slug: null },
        500,
      );
    }
  };
}

// =====================================================================
// Internal: fetch user profile via Lens me query
// =====================================================================

const ME_QUERY = `query {
  me {
    loggedInAs {
      ... on AccountManaged {
        account {
          metadata { name picture bio coverPicture }
          username { localName }
        }
      }
      ... on AccountOwned {
        account {
          metadata { name picture bio coverPicture }
          username { localName }
        }
      }
    }
  }
}`;

async function fetchUserProfile(accessToken: string): Promise<{
  name: string | null;
  picture: string | null;
  bio: string | null;
  coverPicture: string | null;
  localName: string | null;
} | null> {
  try {
    const res = await fetch(LENS_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-access-token": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: ME_QUERY }),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, unknown>;
    const me = (json?.data as Record<string, unknown>)?.me as Record<string, unknown> | undefined;
    const loggedInAs = me?.loggedInAs as Record<string, unknown> | undefined;
    const account = loggedInAs?.account as Record<string, unknown> | undefined;
    const metadata = account?.metadata as Record<string, unknown> | undefined;
    const username = account?.username as Record<string, unknown> | undefined;

    return {
      name: (metadata?.name as string | null) ?? null,
      picture: (metadata?.picture as string | null) ?? null,
      bio: (metadata?.bio as string | null) ?? null,
      coverPicture: (metadata?.coverPicture as string | null) ?? null,
      localName: (username?.localName as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// =====================================================================
// Environment status
// =====================================================================

/**
 * Create a GET route that returns environment variable status.
 */
export function createEnvStatusRoute() {
  return (c: Context) => {
    return c.json({
      apiBaseConfigured: !!process.env.API_BASE_URL,
      orbAccessTokenConfigured: !!process.env.ORB_ACCESS_TOKEN,
    });
  };
}
