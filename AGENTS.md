# Repository Guidelines

## Project Structure

- `src/core/`: `createSDK`, plugin typing, runtime helpers, and core SDK errors.
- `src/auth/`: auth/session plugin and token helpers.
- `src/auth/qr/`: browser-site Sign in with Orb (`connectWithQr`) extension for `sdk.auth`; `legacy.ts` holds throwing stubs for the removed 0.1.x proxy helpers.
- `src/auth/site/`: `/.well-known/orb-siwo.json` manifest handler (Fetch-API `Request -> Response`).
- `src/media/`: gateway-aware media parsing plugin.
- `src/upload/grove/`: optional Grove upload plugin.
- `src/transport/backend/`: optional backend transport plugin.
- `tests/`: Vitest runtime tests and `tests/types/` compile-time surface tests.
- `docs/`: public docs and agent-facing reference pages.
- `docs/superpowers/`: internal specs and plans that drive implementation.

## Public API Rules

- Root exports stay small: `createSDK`, core errors, and core types.
- Feature plugins are imported from subpaths. Do not re-export plugins from the package root.
- Keep the public surface generic. Do not add Orb-specific names, hardcoded service URLs, or app-specific route contracts.
- Keep the core framework-agnostic. UI state and framework adapters belong outside the v1 core package surface.
- Every plugin owns one namespace on the SDK instance. Avoid cross-plugin helper exports that bypass `createSDK`.

## Runtime Rules

- `upload/grove` is browser-only.
- `transport/backend` is for trusted runtimes or explicit proxy routes.
- `auth/qr` sign-in must run in the browser: the backend rate-limits per client IP. Never add a server proxy for it.
- `auth/site` runs on the server and depends only on the Fetch API (`Request`/`Response`), not on a framework.
- Sign in with Orb issues no refresh token. Do not add refresh logic for it; sessions end at the access token's expiry.
- `auth` and `media` should work in either browser or server environments.
- The package does not read environment variables directly. Docs may suggest env names, but runtime code should take config objects.

## Workflow Expectations

- Add or update tests for every behavior change.
- Add or update type tests when plugin capabilities or config types change.
- Update `README.md`, `llms.txt`, and the relevant docs page whenever the public API, examples, or runtime expectations change.
- Keep docs written as current behavior, not changelog prose. Record changes in `CHANGELOG.md` and bump `package.json` with every release-worthy change.
- Run `bun run check` and the targeted test commands for the slice you changed before committing.

## Naming and Scope

- Prefer functional names such as `backend`, `auth`, `transport`, `media`, `upload`.
- Avoid legacy app-branded names in public APIs, docs, and examples.
- Keep modules small and explicit. If a feature needs a new runtime or framework boundary, isolate it behind a new plugin or future package rather than widening an existing plugin.
