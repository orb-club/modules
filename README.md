# @orb-club/modules

Shared TypeScript modules for authentication, media handling, API clients, and server-side adapters.

## Install

```bash
bun add @orb-club/modules
```

## Modules

| Import | What it does |
|--------|-------------|
| `@orb-club/modules/orb-auth` | QR sign-in helpers and JWT utilities |
| `@orb-club/modules/orb-api` | Typed client helpers for local API route proxies |
| `@orb-club/modules/media` | Media URL parsing and gateway-aware routing |
| `@orb-club/modules/grove-upload` | Browser-side Grove uploads with progress tracking |
| `@orb-club/modules/adapters/hono` | Hono route handler factories for backend and Lens proxy routes |
| `@orb-club/modules/adapters/next` | Next.js App Router handler factories with the same API surface |
| `@orb-club/modules/state/auth` | React auth provider with session persistence and token refresh |
| `@orb-club/modules/state/qr` | React QR sign-in provider with polling and retry handling |

## Configuration

This package is intended to run against application-specific infrastructure. Provide service URLs, backend credentials, and app URL settings through explicit config or environment variables in your host app.

Common runtime values:

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | Application backend base URL for proxied routes |
| `ORB_ACCESS_TOKEN` | Server-side backend access token |
| `ORB_APP_ORIGIN` | App origin used for QR auth requests when headers are unavailable |
| `ORB_QR_BASE_URL` | QR authentication service base URL |
| `ORB_MEDIA_GATEWAY` | Optional image/media CDN base URL |
| `ORB_AUDIO_GATEWAY` | Optional audio CDN base URL |
| `ORB_POST_BASE_URL` | Optional base URL for building public post links |

## Quick Start

### 1. Set up server routes

```ts
import { Hono } from "hono";
import {
  createOrbRoute,
  createQrInitRoute,
  createQrPollRoute,
  createAuthRefreshRoute,
  createAuthRevokeRoute,
  createEnvStatusRoute,
} from "@orb-club/modules/adapters/hono";

const app = new Hono();

app.get("/api/qr/init", createQrInitRoute());
app.post("/api/qr/poll", createQrPollRoute());
app.post("/api/auth/refresh", createAuthRefreshRoute());
app.post("/api/auth/revoke", createAuthRevokeRoute());
app.get("/api/env-status", createEnvStatusRoute());
app.post(
  "/api/example-resource",
  createOrbRoute("resource/get", {
    transformRequest: (body) => ({ ...body, includePreviewData: true }),
  }),
);
```

### 2. Add auth providers

```tsx
import { AuthProvider } from "@orb-club/modules/state/auth";
import { QrLoginProvider } from "@orb-club/modules/state/qr";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QrLoginProvider>{children}</QrLoginProvider>
    </AuthProvider>
  );
}
```

### 3. Use the hooks in components

```tsx
import { useAuth } from "@orb-club/modules/state/auth";
import { useQrLogin } from "@orb-club/modules/state/qr";

function LoginScreen() {
  const { activeUser, isLoggedIn } = useAuth();
  const { state } = useQrLogin();

  if (isLoggedIn) return <p>Welcome {activeUser.handle}</p>;

  return (
    <div>
      {state.qrImage && <img src={state.qrImage} alt="Scan to sign in" />}
      <p>{state.qrMessage}</p>
    </div>
  );
}
```

### 4. Resolve media URLs

```ts
import { parseImage, parseAudioUrl, parseVideoUrl, parseMedia } from "@orb-club/modules/media";

parseImage("lens://abc123", 768, { mediaGateway: "https://cdn.example.com" });
parseAudioUrl("lens://abc123", { audioGateway: "https://audio.example.com" });
parseVideoUrl("ipfs://Qm...");
parseMedia(url, { type: "audio", config: { audioGateway: "https://audio.example.com" } });
```

## Development

```bash
bun install
bun run check
bun run lint
bun run lint:fix
```

Pre-commit hooks enforce type-checking, linting, and [conventional commits](https://www.conventionalcommits.org/).

## License

Set the appropriate public license before publishing.
