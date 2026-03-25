/**
 * @module adapters/next
 *
 * Factory for Next.js API route handlers that proxy requests to an app backend.
 *
 * @example
 *   // app/api/user/route.ts
 *   import { createOrbRoute } from '@orb-club/modules/adapters/next'
 *   export const POST = createOrbRoute('resource/get')
 */

import { type NextRequest, NextResponse } from "next/server";
import { LENS_API_URL, POST_BY_TX_QUERY, REFRESH_MUTATION, REVOKE_MUTATION } from "../constants";

// =====================================================================
// Configuration
// =====================================================================

export interface OrbProxyConfig {
  /** App backend base URL. Reads from API_BASE_URL env var by default. */
  backendBaseUrl?: string;
  /** Server-side backend access token. Reads from ORB_ACCESS_TOKEN env var by default. */
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
// Route factory
// =====================================================================

/**
 * Create a Next.js POST route handler that proxies to an app backend.
 *
 * The client sends `{ xAccessToken, ...params }`. The handler forwards the
 * remaining payload to `API_BASE_URL/<backendPath>` and injects the configured
 * backend authentication headers.
 */
export function createOrbRoute(backendPath: string, options?: RouteOptions) {
  return async function POST(request: NextRequest) {
    const apiBase = options?.config?.backendBaseUrl ?? process.env.API_BASE_URL;
    const orbToken = options?.config?.orbAccessToken ?? process.env.ORB_ACCESS_TOKEN;

    if (!apiBase || !orbToken) {
      return NextResponse.json(
        { message: "Server misconfigured: missing API_BASE_URL or ORB_ACCESS_TOKEN" },
        { status: 500 },
      );
    }

    try {
      const body = await request.json();
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
        data = options.transformResponse(data);
      }

      if (data?.status === "FAILED") {
        return NextResponse.json(data, { status: 400 });
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error(`[proxy ${backendPath}]`, error);
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Proxy error" },
        { status: 500 },
      );
    }
  };
}

// =====================================================================
// QR Auth route factories
// =====================================================================

export interface QrRouteConfig {
  /** QR API base URL. */
  qrApiUrl?: string;
}

function getOrigin(request: NextRequest): string {
  const originHeader = request.headers.get("origin");
  if (originHeader) return originHeader;

  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return refererHeader.replace(/\/$/, "");
    }
  }

  return process.env.ORB_APP_ORIGIN ?? request.nextUrl.origin;
}

/**
 * Create a GET route that initializes a QR sign-in session.
 *
 * @param credentials - 'id' | 'id_access' | 'id_access_refresh'. Default: 'id_access'
 */
export function createQrInitRoute(credentials = "id_access", config?: QrRouteConfig) {
  return async function GET(request: NextRequest) {
    const qrApi = config?.qrApiUrl ?? process.env.ORB_QR_BASE_URL;
    if (!qrApi) {
      return NextResponse.json(
        { message: "Server misconfigured: missing ORB_QR_BASE_URL or qrApiUrl" },
        { status: 500 },
      );
    }
    try {
      const origin = getOrigin(request);
      const response = await fetch(`${qrApi}/init-sign-in?credentials=${credentials}`, {
        headers: { origin, referer: origin },
      });
      if (!response.ok) {
        return NextResponse.json(
          { message: `QR init failed (${response.status})` },
          { status: response.status },
        );
      }
      const data = await response.json();
      return NextResponse.json({ message: "QR init", data });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "QR init failed" },
        { status: 500 },
      );
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
    request: NextRequest;
  }) => Promise<void> | void;
}

/**
 * Create a POST route that polls a QR sign-in session.
 * Enriches with user profile on success (default). Supports `onSuccess` hook
 * for server-side session creation.
 */
export function createQrPollRoute(config?: QrPollRouteConfig) {
  return async function POST(request: NextRequest) {
    const qrApi = config?.qrApiUrl ?? process.env.ORB_QR_BASE_URL;
    if (!qrApi) {
      return NextResponse.json(
        { message: "Server misconfigured: missing ORB_QR_BASE_URL or qrApiUrl" },
        { status: 500 },
      );
    }
    try {
      const { secret } = await request.json();
      if (!secret) {
        return NextResponse.json({ message: "Secret is required" }, { status: 400 });
      }
      const origin = getOrigin(request);
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
        return NextResponse.json(
          { message: `QR poll failed (${response.status})` },
          { status: response.status },
        );
      }
      const data = await response.json();

      // On successful login, optionally enrich profile and run the hook.
      const pollData = data?.data;
      if (data?.status === "SUCCESS" && pollData?.processed === true && pollData?.accessToken) {
        let profile: Awaited<ReturnType<typeof fetchUserProfile>> = null;
        if (config?.enrichProfile !== false) {
          profile = await fetchUserProfile(pollData.accessToken);
          if (profile) {
            data.profile = profile;
          }
        }

        if (config?.onSuccess) {
          await config.onSuccess({ pollData, profile, request });
        }
      }

      return NextResponse.json({ message: "QR poll", data });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "QR poll failed" },
        { status: 500 },
      );
    }
  };
}

// =====================================================================
// Lens GraphQL route factories
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
  return async function POST(request: NextRequest) {
    try {
      const { refreshToken } = await request.json();
      if (!refreshToken) {
        return NextResponse.json({ message: "refreshToken is required" }, { status: 400 });
      }

      const response = await fetch(lensApi, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: REFRESH_MUTATION,
          variables: { request: { refreshToken } },
        }),
      });

      const json = await response.json();
      const result = json?.data?.refresh;

      if (result?.__typename === "ForbiddenError") {
        return NextResponse.json(
          { message: `Forbidden: ${result.reason}`, error: "FORBIDDEN" },
          { status: 403 },
        );
      }

      return NextResponse.json({
        message: "Token refreshed",
        accessToken: result?.accessToken,
        refreshToken: result?.refreshToken,
        idToken: result?.idToken,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Refresh failed" },
        { status: 500 },
      );
    }
  };
}

/**
 * Create a POST route that revokes a Lens authentication session.
 */
export function createAuthRevokeRoute(config?: LensRouteConfig) {
  const lensApi = config?.lensApiUrl ?? LENS_API_URL;
  return async function POST(request: NextRequest) {
    try {
      const { authenticationId, accessToken } = await request.json();
      if (!authenticationId || !accessToken) {
        return NextResponse.json(
          { message: "authenticationId and accessToken are required" },
          { status: 400 },
        );
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
        return NextResponse.json(
          { message: `Revoke failed (${response.status})${text ? `: ${text}` : ""}` },
          { status: response.status },
        );
      }

      return NextResponse.json({ message: "Authentication revoked", success: true });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Revoke failed" },
        { status: 500 },
      );
    }
  };
}

/**
 * Create a POST route that fetches a post slug from a Lens tx hash.
 */
export function createPostByTxRoute(config?: LensRouteConfig) {
  const lensApi = config?.lensApiUrl ?? LENS_API_URL;
  return async function POST(request: NextRequest) {
    try {
      const { txHash } = await request.json();
      if (!txHash) {
        return NextResponse.json({ message: "txHash is required", slug: null }, { status: 400 });
      }

      const response = await fetch(lensApi, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: POST_BY_TX_QUERY,
          variables: { txHash },
        }),
      });

      const json = await response.json();
      const slug = json?.data?.post?.slug ?? null;
      return NextResponse.json({ message: slug ? "Slug found" : "No slug yet", slug });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Lookup failed", slug: null },
        { status: 500 },
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

    const json = await res.json();
    const loggedInAs = json?.data?.me?.loggedInAs;
    const account = loggedInAs?.account;
    const metadata = account?.metadata;
    const username = account?.username;

    return {
      name: metadata?.name ?? null,
      picture: metadata?.picture ?? null,
      bio: metadata?.bio ?? null,
      coverPicture: metadata?.coverPicture ?? null,
      localName: username?.localName ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Create a GET route that returns environment variable status.
 */
export function createEnvStatusRoute() {
  return async function GET() {
    return NextResponse.json({
      apiBaseConfigured: !!process.env.API_BASE_URL,
      backendAccessTokenConfigured: !!process.env.ORB_ACCESS_TOKEN,
    });
  };
}
