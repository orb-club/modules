# @orb-club/modules

Shared TypeScript modules for the Orb ecosystem — authentication, media handling, API client, and server-side adapters for Hono and Next.js.

## Install

```bash
bun add @orb-club/modules
```

## Modules

| Import | What it does |
|--------|-------------|
| `@orb-club/modules/orb-auth` | QR login flow + Lens JWT utilities (decode, refresh, revoke, verify) |
| `@orb-club/modules/orb-api` | Typed client for Orb backend (posts, users, clubs, drafts, widgets, feeds, search) |
| `@orb-club/modules/media` | Media URL parsing with gateway-aware routing (audio CDN, image thumbnails, video raw) |
| `@orb-club/modules/grove-upload` | Browser-side file upload to Lens Grove Storage with progress tracking |
| `@orb-club/modules/adapters/hono` | Hono route handler factories for Orb backend + Lens API proxying |
| `@orb-club/modules/adapters/next` | Next.js App Router route handler factories (same API surface) |
| `@orb-club/modules/state/auth` | React `AuthProvider` / `useAuth` — session persistence, auto token refresh |
| `@orb-club/modules/state/qr` | React `QrLoginProvider` / `useQrLogin` — QR sign-in flow with auto-start |

## Quick Start

### 1. Set up server routes (Hono example)

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
app.post("/api/user", createOrbRoute("MAINNET-QUERIES/get-user"));
app.post("/api/clubs", createOrbRoute("MAINNET-QUERIES/get-clubs"));
app.post("/api/create-post", createOrbRoute("MAINNET-MUTATIONS/create-post-tx", {
  transformRequest: (body) => ({ ...body, task: "CREATE_ITEM", includePreviewData: true }),
}));
```

### 2. Add auth providers (React)

```tsx
import { AuthProvider } from "@orb-club/modules/state/auth";
import { QrLoginProvider } from "@orb-club/modules/state/qr";

function App() {
  return (
    <AuthProvider>
      <QrLoginProvider>
        <YourApp />
      </QrLoginProvider>
    </AuthProvider>
  );
}
```

### 3. Use in components

```tsx
import { useAuth } from "@orb-club/modules/state/auth";
import { useQrLogin } from "@orb-club/modules/state/qr";

function LoginScreen() {
  const { activeUser, isLoggedIn } = useAuth();
  const { state, handleStartQrSignIn } = useQrLogin();

  if (isLoggedIn) return <p>Welcome {activeUser.handle}</p>;

  return (
    <div>
      {state.qrImage && <img src={state.qrImage} alt="Scan to login" />}
      <p>{state.qrMessage}</p>
    </div>
  );
}
```

### 4. Media URL parsing

```ts
import { parseImage, parseAudioUrl, parseVideoUrl, parseMedia } from "@orb-club/modules/media";

parseImage("lens://abc123");        // → https://media.orbapi.xyz/thumbnailDimension768/https://api.grove.storage/abc123
parseAudioUrl("lens://abc123");     // → https://audio.orb.ac/https://api.grove.storage/abc123
parseVideoUrl("ipfs://Qm...");     // → https://gw.ipfs-lens.dev/ipfs/Qm...
parseMedia(url, { type: "audio" }) // gateway-aware routing by media type or MIME string
```

## Environment Variables

Required server-side:

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | Orb backend URL |
| `ORB_ACCESS_TOKEN` | Server-side auth token for Orb backend |
| `ORB_APP_ORIGIN` | App domain (fallback for QR auth origin header) |

## Development

```bash
bun install
bun run check      # type-check
bun run lint       # lint + format check (biome)
bun run lint:fix   # auto-fix
```

Pre-commit hooks enforce type-checking, linting, and [conventional commits](https://www.conventionalcommits.org/).

## License

Private — @orb-club
