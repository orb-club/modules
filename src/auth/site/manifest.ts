import { ORB_SIWO_MANIFEST_PATH } from "../defaults";

/**
 * The opt-in manifest for browser-site Sign in with Orb.
 *
 * Before it issues a sign-in for an origin, the Orb backend fetches
 * `GET {origin}/.well-known/orb-siwo.json` and refuses unless it answers
 * HTTP 200 with `Content-Type: application/json`, under 2KB, with exactly
 * `{"version":1,"origin":"<that origin>"}`. Serving it is all a site needs to
 * opt in: no key, secret or server proxy is involved.
 */
export type SiwoManifest = {
  version: 1;
  origin: string;
};

export type SiwoManifestHandlerConfig =
  | {
      /** The one production origin this deployment signs in as, e.g. `https://app.example.com`. */
      origin: string;
    }
  | {
      /**
       * Every production origin this deployment serves. The request's Host
       * picks the matching one; any other host gets a 404.
       */
      origins: readonly string[];
    };

/** Answers GET/HEAD with the manifest, 404 for a Host outside the allow-list, 405 for other methods. */
export type SiwoManifestHandler = (request?: Request) => Response;

export class SiwoManifestConfigError extends Error {
  code = "SIWO_MANIFEST_CONFIG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "SiwoManifestConfigError";
  }
}

export { ORB_SIWO_MANIFEST_PATH };

/**
 * Validates an origin for the manifest: `https:`, scheme + host (+ port) only,
 * no path, query, fragment, credentials or trailing slash. Returns it unchanged.
 */
export function normalizeSiwoOrigin(origin: string): string {
  let url: URL;

  try {
    url = new URL(origin);
  } catch {
    throw new SiwoManifestConfigError(
      `Invalid Sign in with Orb origin: ${JSON.stringify(origin)}.`,
    );
  }

  if (url.protocol !== "https:" || url.origin !== origin) {
    throw new SiwoManifestConfigError(
      `Sign in with Orb origin must be an exact https origin such as "https://app.example.com" (no path or trailing slash); got ${JSON.stringify(origin)}.`,
    );
  }

  return origin;
}

/** The manifest body for `origin`: exactly `{ version: 1, origin }`. */
export function createSiwoManifest(origin: string): SiwoManifest {
  return { version: 1, origin: normalizeSiwoOrigin(origin) };
}

/**
 * Picks the allowed origin whose host matches `host` (a request's Host
 * header, with optional port). Returns `null` when none does.
 */
export function resolveSiwoOrigin(
  origins: readonly string[],
  host: string | null | undefined,
): string | null {
  if (!host) {
    return null;
  }

  const wanted = host.trim().toLowerCase();
  for (const origin of origins) {
    if (new URL(normalizeSiwoOrigin(origin)).host === wanted) {
      return origin;
    }
  }

  return null;
}

function hostOf(request: Request): string | null {
  const header = request.headers.get("host");
  if (header) {
    return header;
  }

  try {
    return new URL(request.url).host;
  } catch {
    return null;
  }
}

function json(body: unknown, status: number, cacheControl: string, head: boolean): Response {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * A Web-standard `Request -> Response` handler for
 * `GET /.well-known/orb-siwo.json`. It validates the configured origin(s) when
 * created, so a misconfiguration fails at startup rather than at sign-in.
 *
 * Next.js App Router (`app/.well-known/orb-siwo.json/route.ts`):
 *
 *     export const GET = createSiwoManifestHandler({ origin: "https://app.example.com" });
 *
 * Hono:
 *
 *     const manifest = createSiwoManifestHandler({ origin: "https://app.example.com" });
 *     app.get(ORB_SIWO_MANIFEST_PATH, (c) => manifest(c.req.raw));
 *
 * Make sure no SPA fallback or rewrite answers this path with `index.html`.
 */
export function createSiwoManifestHandler(config: SiwoManifestHandlerConfig): SiwoManifestHandler {
  const origins = "origins" in config ? [...config.origins] : [config.origin];

  if (origins.length === 0) {
    throw new SiwoManifestConfigError("At least one Sign in with Orb origin is required.");
  }

  for (const origin of origins) {
    normalizeSiwoOrigin(origin);
  }

  const single = "origin" in config;

  return (request?: Request) => {
    const method = request?.method?.toUpperCase() ?? "GET";
    const head = method === "HEAD";

    if (method !== "GET" && !head) {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const origin = single
      ? origins[0]
      : request
        ? resolveSiwoOrigin(origins, hostOf(request))
        : null;

    if (!origin) {
      return json(
        { message: "Sign in with Orb is not configured for this origin." },
        404,
        "no-store",
        head,
      );
    }

    return json(createSiwoManifest(origin), 200, "public, max-age=300", head);
  };
}
