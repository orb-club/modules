# @orbclub/modules

Auth-first TypeScript modules for Orb login, Lens session refresh, media primitives, uploads, and optional backend transport.

The package surface is intentionally small:

- root export: `createSDK`
- happy-path login entrypoint: `auth`
- site manifest helper: `auth/site`
- lower-level plugin entrypoints: `auth/qr`, `auth/lens`, `media`, `upload/grove`, `transport/backend`
- no UI framework state in the core package
- Sign in with Orb runs in the browser (browser-site protocol); no auth proxy routes

## Install

```bash
npm install @orbclub/modules
```

## Quick Start

```ts
import { createOrbLogin } from "@orbclub/modules/auth";

const orb = createOrbLogin();
const qrImage = document.querySelector<HTMLImageElement>("#orb-qr");
const orbLink = document.querySelector<HTMLAnchorElement>("#orb-link");

const session = await orb.connectWithQr({
  onInit: ({ qrCode, deepLink }) => {
    if (qrImage) qrImage.src = qrCode;
    if (orbLink) {
      orbLink.href = deepLink; // "Open Orb app" on phones
      orbLink.hidden = !orb.prefersDeepLink();
    }
  },
});

// No refresh token exists: the session ends with the ~10-minute access token.
orb.watchSessionExpiry(session.expiresAt, () => signOut());
```

Serve the opt-in manifest from your site (Next.js App Router shown; Hono and
static hosting in [docs/auth.md](docs/auth.md#site-manifest)):

```ts
// app/.well-known/orb-siwo.json/route.ts
import { createSiwoManifestHandler } from "@orbclub/modules/auth/site";

export const GET = createSiwoManifestHandler({ origin: "https://app.example.com" });
```

Checklist:

- `GET /.well-known/orb-siwo.json` answers `{"version":1,"origin":"<exact origin>"}`
  as `application/json` (not your SPA's `index.html`).
- CSP `connect-src` allows `https://orbapi.xyz`.
- Sign-in runs in the browser: the backend limits each client IP to 12 inits
  and 120 polls a minute, so a server proxy would throttle everyone together.
- The first sign-in for a new origin can spend a few minutes provisioning.
- Preview deployments on other origins cannot sign in.
- The session lasts about 10 minutes and cannot be refreshed; end it at
  `expiresAt` and prompt again.

The package does not read or write browser storage. Upgrading from 0.1.x: see
[docs/auth.md#migrating-from-01x](docs/auth.md#migrating-from-01x) and
[CHANGELOG.md](CHANGELOG.md).

## Plugins

| Import | Purpose | Runtime |
| --- | --- | --- |
| `@orbclub/modules/auth` | Sign in with Orb (`createOrbLogin`) plus token/session expiry helpers | Browser (sign-in) or server (helpers) |
| `@orbclub/modules/auth/site` | `/.well-known/orb-siwo.json` manifest handler (Next.js, Hono, any Fetch-API server) | Server |
| `@orbclub/modules/auth/qr` | Lower-level browser-site sign-in plugin | Browser |
| `@orbclub/modules/auth/lens` | Lens GraphQL refresh helpers layered onto `sdk.auth` | Browser or server |
| `@orbclub/modules/media` | Media URL parsing and gateway-aware resolution | Browser or server |
| `@orbclub/modules/upload/grove` | Browser-side Grove upload plugin with progress tracking | Browser only |
| `@orbclub/modules/transport/backend` | Minimal JSON backend caller with header injection | Trusted browser/server runtime |

## Runtime Boundaries

- `createOrbLogin()` signs in against `https://orbapi.xyz` from the page; it must not be proxied through a server.
- `createSDK` is available for custom plugin composition. Import only what you need.
- The package does not read environment variables directly. Resolve config in your app and pass it into plugin factories.
- Media parsing resolves `ipfs://`, `ar://`, `lens://`, embedded storage URIs, and existing `thumbnailDimension...` proxy URLs before optional image or audio gateway wrapping.
- Bare media paths without a recognized URI scheme are returned as-is.
- `upload/grove` requires browser upload APIs such as `File`, `FormData`, and `XMLHttpRequest`.
- `transport/backend` is intended for trusted app infrastructure or explicit proxy routes.
- Framework adapters and UI state are not part of the v1 core package surface.

## Docs

- [docs/getting-started.md](docs/getting-started.md)
- [docs/auth.md](docs/auth.md)
- [docs/configuration.md](docs/configuration.md)
- [docs/media.md](docs/media.md)
- [docs/upload-grove.md](docs/upload-grove.md)
- [docs/transport-backend.md](docs/transport-backend.md)
- [docs/errors.md](docs/errors.md)
- `llms.txt` for agent-oriented navigation

## Development

```bash
bun install
bun run check
bun run test
bun run lint
```

CI runs typechecking, runtime tests, type tests, linting, build, and package dry-run checks. Update `README.md`, `llms.txt`, and the relevant files under `docs/` whenever the public API or examples change.
