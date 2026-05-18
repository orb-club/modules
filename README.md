# @orbclub/modules

Auth-first TypeScript modules for Orb login, Lens session refresh, media primitives, uploads, and optional backend transport.

The package surface is intentionally small:

- root export: `createSDK`
- happy-path login entrypoint: `auth`
- lower-level plugin entrypoints: `auth/qr`, `auth/lens`, `media`, `upload/grove`, `transport/backend`
- no UI framework state in the core package
- browser-direct Orb login by default

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
    if (orbLink && deepLink) orbLink.href = deepLink;
  },
});
```

`createOrbLogin()` uses browser-direct defaults for Orb QR sign-in and Lens
session refresh. No app auth proxy routes are required for the default flow.
Session persistence is an app-level security decision; the package does not read
or write browser storage.

## Plugins

| Import | Purpose | Runtime |
| --- | --- | --- |
| `@orbclub/modules/auth` | Browser-direct Orb login plus session helpers | Browser or server |
| `@orbclub/modules/auth/qr` | Lower-level QR auth helpers | Browser client |
| `@orbclub/modules/auth/lens` | Lens GraphQL refresh helpers layered onto `sdk.auth` | Browser or server |
| `@orbclub/modules/media` | Media URL parsing and gateway-aware resolution | Browser or server |
| `@orbclub/modules/upload/grove` | Browser-side Grove upload plugin with progress tracking | Browser only |
| `@orbclub/modules/transport/backend` | Minimal JSON backend caller with header injection | Trusted browser/server runtime |

## Runtime Boundaries

- `createOrbLogin()` uses direct Orb QR and Lens GraphQL defaults.
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
