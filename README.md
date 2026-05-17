# @orb-club/modules

Auth-first, plugin-based TypeScript SDK for apps built on token-based auth, media primitives, uploads, and optional backend transport.

The package surface is intentionally small:

- root export: `createSDK`
- plugin entrypoints: `auth`, `auth/qr`, `media`, `upload/grove`, `transport/backend`
- no UI framework state in the core package
- no hardcoded app or backend defaults in the runtime

## Install

```bash
bun add @orb-club/modules
```

## Quick Start

```ts
import { createSDK } from "@orb-club/modules";
import { authPlugin } from "@orb-club/modules/auth";
import { lensAuthPlugin } from "@orb-club/modules/auth/lens";
import { qrAuthPlugin } from "@orb-club/modules/auth/qr";
import { mediaPlugin } from "@orb-club/modules/media";

const sdk = createSDK({
  plugins: [
    authPlugin({
      refreshUrl: "/api/auth/refresh",
      revokeUrl: "/api/auth/revoke",
    }),
    lensAuthPlugin({
      graphqlUrl: "https://api.lens.xyz/graphql",
    }),
    qrAuthPlugin({
      initUrl: "/api/auth/qr/init",
      pollUrl: "/api/auth/qr/poll",
      pollIntervalMs: 2_000,
    }),
    mediaPlugin({
      imageGateway: "https://cdn.example.com",
      audioGateway: "https://audio.example.com",
    }),
  ],
});

const nextSession = await sdk.auth.refresh({
  refreshToken: "refresh-token",
});

const lensSession = await sdk.auth.refreshLensSession({
  refreshToken: "refresh-token",
});

const qrSession = await sdk.auth.connectWithQr({
  onInit: ({ qrCode }) => {
    console.log(qrCode);
  },
});

console.log(qrSession.accessToken);

const imageUrl = sdk.media.parseImage("lens://asset", 768);
```

## Plugins

| Import | Purpose | Runtime |
| --- | --- | --- |
| `@orb-club/modules/auth` | Session refresh/revoke helpers and token utilities | Browser or server |
| `@orb-club/modules/auth/qr` | QR auth flow helpers layered onto `sdk.auth` | Browser client plus app-provided QR endpoints |
| `@orb-club/modules/auth/lens` | Lens GraphQL refresh helpers layered onto `sdk.auth` | Browser or server |
| `@orb-club/modules/media` | Media URL parsing and gateway-aware resolution | Browser or server |
| `@orb-club/modules/upload/grove` | Browser-side Grove upload plugin with progress tracking | Browser only |
| `@orb-club/modules/transport/backend` | Minimal JSON backend caller with header injection | Trusted browser/server runtime |

## Runtime Boundaries

- `createSDK` does not auto-register plugins. Import only what you need.
- The package does not read environment variables directly. Resolve config in your app and pass it into plugin factories.
- Media parsing resolves `ipfs://`, `ar://`, `lens://`, embedded storage URIs, and existing `thumbnailDimension...` proxy URLs before optional image or audio gateway wrapping.
- Bare media paths without a recognized URI scheme are returned as-is.
- `upload/grove` requires browser upload APIs such as `File`, `FormData`, and `XMLHttpRequest`.
- `transport/backend` is intended for trusted app infrastructure or explicit proxy routes.
- Framework adapters and UI state are not part of the v1 core package surface.

## Suggested App Config

The library accepts plain config objects. If your app uses environment variables, keep the mapping in your host app. These names work well as a generic convention:

- `AUTH_REFRESH_URL`
- `AUTH_REVOKE_URL`
- `QR_INIT_URL`
- `QR_POLL_URL`
- `LENS_GRAPHQL_URL`
- `MEDIA_GATEWAY`
- `AUDIO_GATEWAY`
- `GROVE_API_URL`
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN`

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

Pre-commit hooks run formatting on staged files. Update `README.md`, `llms.txt`, and the relevant files under `docs/` whenever the public API or examples change.
