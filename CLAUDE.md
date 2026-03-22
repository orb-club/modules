# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@orb-club/modules` — shared TypeScript modules for the Orb ecosystem (a Lens Protocol social app). This is a library package consumed by other projects (e.g., Next.js or Hono apps) via package exports. There is no build step; raw `.ts`/`.tsx` files are exported directly.

## Commands

```bash
bun install          # install dependencies
bun run check        # type-check the entire project
bun run lint         # lint + format check (biome)
bun run lint:fix     # lint + format auto-fix
```

Pre-commit hooks (husky) run type-check + lint-staged automatically. Commits must follow conventional commits format (`feat:`, `fix:`, `chore:`, etc.).

## Architecture

### Constants

`constants.ts` — single source of truth for all URLs, gateway domains, chain IDs, timeouts, and defaults. No hardcoded values in module files.

### Module layers

**Client-side modules** (browser, framework-agnostic):
- `orb-auth.ts` — QR-based login flow + pure JWT utilities (decode, expiry check, refresh, revoke). All network calls go through local API route proxies, never directly to backends.
- `orb-api.ts` — Typed client for Orb backend endpoints (posts, users, clubs, drafts, widgets, feeds, search). Also calls through local proxy routes.
- `media.ts` — MIME type enums, category detection, gateway-aware media URL resolution. `parseMedia(url, { type })` routes through the correct CDN: images → `media.orbapi.xyz` thumbnail gateway, audio → `audio.orb.ac` (only for non-Grove URLs; Grove has its own CDN), video → raw resolved URL. `parseUrl()` handles protocol resolution (ipfs://, ar://, lens://, autodetect `/ipfs/`).
- `grove-upload.ts` — Browser-side file upload to Lens Grove Storage via XHR (bypasses serverless payload limits). Progress tracking with propagation polling.

**Server-side adapters** (`adapters/`):
- `adapters/next.ts` — Next.js App Router route handler factories (`createOrbRoute`, `createQrInitRoute`, etc.). Uses `NextRequest`/`NextResponse`.
- `adapters/hono.ts` — Identical API surface for Hono. Uses `Context` from hono.

Both adapters import shared API URLs from `constants.ts` and follow the same pattern: `createOrbRoute(backendPath, options?)` returns a handler that extracts `xAccessToken` from the request body, forwards the rest to the Orb backend with server-side auth headers (`orb-access-token`, `x-access-token`). All routes validate required inputs before making upstream requests.

**React state** (`state/`):
- `state/auth/` — `AuthProvider`/`useAuth` hook. Manages session persistence (localStorage), automatic token refresh on interval, and hydration from storage.
- `state/qr/` — `QrLoginProvider`/`useQrLogin` hook. Wraps the QR sign-in flow (init, poll, auto-retry). Must be nested inside `AuthProvider`. Fetches user profile picture after login.
- `state/types.ts` — `UserSession` interface shared across state modules.

### Key patterns

- **Proxy architecture**: Client modules never call external APIs directly. They call local `/api/*` routes, which the adapter layer proxies to the Orb backend (`API_BASE_URL`) or Lens GraphQL API.
- **Result types**: All client functions return `{ ok: boolean; message: string; data?: ... }`. Errors are caught and returned as `{ ok: false }`, never thrown.
- **Config injection**: Every function accepts an optional trailing `config` parameter for overriding API base URLs and gateways. Defaults come from `constants.ts` or `process.env`.

### Required environment variables (server-side)

- `API_BASE_URL` — Orb backend URL
- `ORB_ACCESS_TOKEN` — Server-side auth token for the Orb backend
- `ORB_APP_ORIGIN` — App domain (fallback for origin header in QR auth)
