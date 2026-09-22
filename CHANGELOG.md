# Changelog

All notable changes to `@orbclub/modules`. Versions map to git tags `modules-v<version>`
(see `docs/release.md`). While the package is `0.x`, a minor bump may contain breaking changes.

## 0.2.0 - 2026-09-22

Sign in with Orb moves to the browser-site protocol, the only web sign-in
protocol enabled on the Orb backend. The legacy QR flow
(`/init-sign-in` + `/poll-sign-in`) is disabled on MAINNET, so 0.1.x sign-in
already fails there with "Sign in with Orb is temporarily unavailable".

### Breaking

- `connectWithQr()` (on `createOrbLogin()` and `qrAuthPlugin`) now runs
  browser-site sign-in in the page: `POST https://orbapi.xyz/init-site-sign-in`
  and `/poll-site-sign-in` with PKCE, until the approval's `expiresAt` (~5 min).
  The name and the `{ signal, onInit }` call shape are unchanged.
- `onInit` receives `{ qrCode, deepLink, expiresAt }` (`deepLink` always present).
- The result is `{ processed: true, source: "lens", user_id, idToken, accessToken, expiresAt }`.
  `refreshToken` and `authenticationId` are gone; a response carrying a
  `refreshToken` is rejected.
- Removed `qrAuthPlugin` / `createOrbLogin({ qr })` options: `initUrl`, `pollUrl`,
  `credentials`, `headers`, `timeoutMs`, `initTimeoutMs`, `pollTimeoutMs`,
  `parseInitResponse`, `parsePollResponse`. Removed call options: `credentials`,
  `headers`, `timeoutMs`, `pollIntervalMs`. They are TypeScript errors, and at
  runtime `connectWithQr()` rejects with `QrLegacyFlowError` instead of calling
  disabled endpoints.
- `createQrInitRequest`, `createQrPollRequest`, `parseQrInitResponse`,
  `parseQrPollResponse` (the building blocks for server proxy routes) are
  deprecated stubs that always throw `QrLegacyFlowError` with migration
  instructions. They keep existing imports compiling so a stale proxy route
  fails on its own, loudly, rather than breaking the whole bundle. They will be
  removed in 0.3.0. Types `ParsedQrInitResponse`, `ParsedQrPollResponse`,
  `QrRequestDescriptor`, `CreateQrInitRequestOptions` and
  `CreateQrPollRequestOptions` are removed.
- `createOrbLogin().refresh()` is deprecated and always rejects with
  `AuthSessionError` (`AUTH_REFRESH_UNSUPPORTED`): no refresh token exists.
- `syncLensSession()` / `createOrbLogin().syncSession()` now return `null` for a
  session without a `refreshToken` whose access token has expired (previously
  such a session was returned as-is).
- `QrAuthError` has a `reason` field; `QrTimeoutError` now means the approval
  expired.

### Added

- `@orbclub/modules/auth/site`: `createSiwoManifestHandler({ origin } | { origins })`,
  a Fetch-API handler for `GET /.well-known/orb-siwo.json` that works as a
  Next.js App Router route (`export const GET = ...`) and in Hono
  (`app.get(ORB_SIWO_MANIFEST_PATH, (c) => handler(c.req.raw))`). Also
  `createSiwoManifest`, `normalizeSiwoOrigin`, `resolveSiwoOrigin`,
  `ORB_SIWO_MANIFEST_PATH`, `SiwoManifestConfigError`.
- `watchSessionExpiry(expiresAt, onExpire)` in `@orbclub/modules/auth` and on
  `createOrbLogin()`, to end a session when its ~10-minute access token dies.
- `prefersDeepLink()` in `@orbclub/modules/auth/qr` and on `createOrbLogin()`,
  for showing an "Open Orb app" link on touch devices.
- `onProvisioning` callback, `QrProvisioningError`, `QrLegacyFlowError`.
- `qrAuthPlugin` options `baseUrl`, `requestTimeoutMs`, `provisioningRetryMs`,
  `provisioningAttempts`. `pollIntervalMs` defaults to 2.5 s and is never below 2 s.

### Migrating

See `docs/auth.md#migrating-from-01x`. In short: delete sign-in proxy routes,
drop legacy options, serve `/.well-known/orb-siwo.json`, add
`https://orbapi.xyz` to CSP `connect-src`, delete refresh-token logic and end
the session at `expiresAt`.

## 0.1.1

- Browser-direct Orb login defaults (`createOrbLogin`) and npm release automation.

## 0.1.0

- First npm release: `createSDK`, auth, QR auth, Lens auth, media, Grove upload,
  backend transport.
