# Auth

Sign in with Orb runs the **browser-site protocol** in the page. It is the only
web sign-in protocol enabled on the Orb backend. The older
`/init-sign-in` + `/poll-sign-in` QR flow and the permissionless
`/exchange-sign-in-code` flow are disabled and are no longer supported by this
package (see [Migrating from 0.1.x](#migrating-from-01x)).

## How it works

1. The page generates a PKCE pair and calls
   `POST https://orbapi.xyz/init-site-sign-in {state, codeChallenge}`.
   The browser's `Origin` header identifies your site. The backend fetches
   `https://<your origin>/.well-known/orb-siwo.json` to confirm the site opted
   in, then answers CORS for that origin.
2. The backend returns an approval: `qrCode` (a PNG data URL), `deepLink`
   (`orbapp://orb/approve?secret=...`) and `expiresAt` (~5 minutes).
3. The page polls `POST https://orbapi.xyz/poll-site-sign-in` every 2.5 s
   until the viewer approves in the Orb app or the approval expires.
4. The result is the viewer's Lens account address, an `idToken` and an
   `accessToken`. **No refresh token is issued.**

`connectWithQr()` does all of this. Your site has to:

- **Serve the manifest** at `GET /.well-known/orb-siwo.json`
  (see [Site manifest](#site-manifest)).
- **Allow the API in your CSP**: add `https://orbapi.xyz` to `connect-src`.
- **Run sign-in in the browser**, not behind a server proxy. The backend
  rate-limits per client IP: 12 inits/min and 120 polls/min per IP, plus 30
  polls/min per sign-in session. Behind a shared server address every viewer
  would share one budget.
- **End the session when the access token expires** (~10 minutes) and prompt
  a new sign-in. Never show a signed-in UI whose token is dead.

Things to expect:

- **First use of a new origin** answers `phase: PROVISIONING` while the
  backend sets the site up. `connectWithQr()` waits 10 s and retries, up to 6
  attempts, calling `onProvisioning` each time. Provisioning can take a few
  minutes; if it is still not ready the attempt rejects with
  `QrProvisioningError` and trying again later works.
- **Preview deployments cannot sign in.** Only the exact origin(s) your
  manifest names can. A `*.vercel.app` preview on another origin gets
  `Sign in with Orb is unavailable`.
- **Local development** on `http://localhost` cannot use browser-site sign-in
  (the manifest origin must be `https`). Test against a deployed https
  origin. The backend's separate local loopback onboarding flow for
  `http://localhost` is not part of this package.

## `createOrbLogin`

```ts
import { createOrbLogin } from "@orbclub/modules/auth";

const orb = createOrbLogin();
const qrImage = document.querySelector<HTMLImageElement>("#orb-qr");
const orbLink = document.querySelector<HTMLAnchorElement>("#orb-link");
const controller = new AbortController();

const session = await orb.connectWithQr({
  signal: controller.signal,
  onProvisioning: () => {
    // First sign-in for this site: show "Setting up Sign in with Orb..."
  },
  onInit: ({ qrCode, deepLink, expiresAt }) => {
    if (qrImage) qrImage.src = qrCode;
    // A phone cannot scan its own screen: offer the deep link on touch devices.
    if (orbLink) {
      orbLink.href = deepLink;
      orbLink.hidden = !orb.prefersDeepLink();
    }
  },
});

// session: { processed: true, source: "lens", user_id, idToken, accessToken, expiresAt }

const stopWatching = orb.watchSessionExpiry(session.expiresAt, () => {
  // The access token is dead: clear your session and show "Sign in" again.
});
```

Defaults:

- Sign-in API: `https://orbapi.xyz`
- Poll interval: `2_500` ms (never below `2_000`)
- Per-request timeout: `10_000` ms
- Provisioning: `6` attempts, `10_000` ms apart
- Lens GraphQL: `https://api.lens.xyz/graphql`

Capabilities:

- `connectWithQr({ signal?, onInit?, onProvisioning? })`
- `prefersDeepLink()`: `true` when `(pointer: coarse)` matches
- `watchSessionExpiry(expiresAt, onExpire)`: returns a stop function
- `syncSession(session)`: the session while its access token is valid, else `null`
- `revoke({ authenticationId, accessToken })`
- `getAccountFromAccessToken(token)`
- token and session expiry helpers
- `refresh(...)`: **deprecated**, always rejects with `AuthSessionError`
  (`AUTH_REFRESH_UNSUPPORTED`) because no refresh token exists

The package does not read or write browser storage. How you keep the session
(memory, or an HttpOnly cookie set after your server verifies the access
token) is your decision, but it must end at `expiresAt`. `onInit` receives only
the display fields; the polling session, state and PKCE verifier never leave
the client.

### Result

| Field | Type | Notes |
| --- | --- | --- |
| `processed` | `true` | |
| `source` | `"lens"` | |
| `user_id` | `string` | The Lens account address (`0x...`). |
| `idToken` | `string` | |
| `accessToken` | `string` | Lives about 10 minutes. |
| `expiresAt` | `number \| null` | Unix ms from the access token's JWT `exp`. `null` means unknown; treat it as expired. |

### Failures

`connectWithQr()` rejects with a `QrAuthError` subclass. Branch on `reason`:

| `reason` | Class | Meaning / UI |
| --- | --- | --- |
| `expired` | `QrTimeoutError` | The approval window passed. Offer "Try again". |
| `cancelled` | `QrCancelledError` | Your `signal` aborted. |
| `unavailable` | `QrRequestError` | Backend answered `FAILED` or 4xx. On init this usually means the manifest is missing or names a different origin. |
| `provisioning` | `QrProvisioningError` | First-use setup is still running. Try again in a few minutes. |
| `invalid` | `QrResponseError` | Response outside the protocol (including any `refreshToken`). |
| `configuration` | `QrAuthError` / `QrLegacyFlowError` | Bad `baseUrl`, missing Web Crypto, or a removed legacy option. |

Network errors, timeouts, 5xx and 429 while polling are retried until
`expiresAt`. A failed init is not retried.

## Site manifest

The backend only issues a sign-in for an origin that serves:

```http
GET /.well-known/orb-siwo.json
200 OK
Content-Type: application/json

{"version":1,"origin":"https://app.example.com"}
```

Exactly those two keys, under 2 KB, and `origin` must equal the page's origin
exactly: scheme + host (+ port), no trailing slash. Make sure an SPA fallback
or rewrite does not answer this path with `index.html`.

`@orbclub/modules/auth/site` builds it:

```ts
import {
  createSiwoManifestHandler,
  ORB_SIWO_MANIFEST_PATH,
} from "@orbclub/modules/auth/site";
```

`createSiwoManifestHandler(config)` returns a Web-standard
`(request?: Request) => Response` handler. It validates the origin(s) when it is
created, so a bad value fails at startup. It answers `GET`/`HEAD` with the
manifest (`Cache-Control: public, max-age=300`), `404` for a host outside the
allow-list, and `405` for other methods.

Next.js App Router, `app/.well-known/orb-siwo.json/route.ts`:

```ts
import { createSiwoManifestHandler } from "@orbclub/modules/auth/site";

export const GET = createSiwoManifestHandler({ origin: "https://app.example.com" });
```

Hono:

```ts
import { createSiwoManifestHandler, ORB_SIWO_MANIFEST_PATH } from "@orbclub/modules/auth/site";

const manifest = createSiwoManifestHandler({ origin: "https://app.example.com" });
app.get(ORB_SIWO_MANIFEST_PATH, (c) => manifest(c.req.raw));
// Register it before any SPA fallback / static catch-all.
```

Several production domains: pass `origins`. The request's `Host` picks the
matching origin; any other host gets `404`.

```ts
createSiwoManifestHandler({
  origins: ["https://app.example.com", "https://www.example.com"],
});
```

A static site can instead ship the file itself, e.g.
`public/.well-known/orb-siwo.json`, provided the host serves it as
`application/json`.

Lower-level helpers: `createSiwoManifest(origin)`, `normalizeSiwoOrigin(origin)`,
`resolveSiwoOrigin(origins, host)`, `SiwoManifestConfigError`.

Resolve the origin in your app (for example from an env var such as
`APP_ORIGIN`); the package does not read environment variables.

## CSP

If your site sends a Content-Security-Policy, allow the sign-in API:

```
connect-src 'self' https://orbapi.xyz
```

The QR image is a `data:` URL, so `img-src` needs `data:`.

## Lower-Level Plugins

### `authPlugin`

```ts
import { authPlugin } from "@orbclub/modules/auth";
```

Required config: `refreshUrl`, `revokeUrl`. Optional: `timeoutMs`, `headers`.

Capabilities added to `sdk.auth`: `decodeToken`, `getTokenExpiry`,
`isTokenExpired`, `tokenExpiresWithin`, `getSessionExpiry`, `isSessionStale`,
`shouldRefreshSession`, `refresh`, `revoke`. `refresh`/`revoke` call your own
app routes; Sign in with Orb itself never issues a refresh token.

### `qrAuthPlugin`

```ts
import { qrAuthPlugin } from "@orbclub/modules/auth/qr";
```

`qrAuthPlugin` extends `sdk.auth`. Install `authPlugin(...)` first.

Config (all optional): `baseUrl`, `pollIntervalMs`, `requestTimeoutMs`,
`provisioningRetryMs`, `provisioningAttempts`.

Capabilities added to `sdk.auth`:

- `connectWithQr(options?)`: the browser-site flow described above
- deprecated stubs that always throw `QrLegacyFlowError`:
  `createQrInitRequest`, `createQrPollRequest`, `parseQrInitResponse`,
  `parseQrPollResponse`

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({ refreshUrl: "/api/auth/refresh", revokeUrl: "/api/auth/revoke" }),
    qrAuthPlugin(),
  ],
});

const session = await sdk.auth.connectWithQr({
  onInit: ({ qrCode, deepLink }) => render(qrCode, deepLink),
});
```

Also exported: `connectWithQr(context, config, options)`, `prefersDeepLink()`,
and the error classes.

### `lensAuthPlugin`

```ts
import { lensAuthPlugin } from "@orbclub/modules/auth/lens";
```

Lens GraphQL helpers layered onto `sdk.auth`: `refreshLensSession`,
`revokeLensSession`, `syncLensSession`, `getLensAccountFromAccessToken`.
Default `graphqlUrl`: `https://api.lens.xyz/graphql`.

`refreshLensSession(...)` only applies to Lens sessions that carry a refresh
token from some other Lens login. Sessions from Sign in with Orb have none.

`syncLensSession(...)` returns a session without a `refreshToken` unchanged
while its access token is valid and `null` once it has expired. With a refresh
token it refreshes inside the refresh window, returns `null` on a Lens
`ForbiddenError`, and keeps the session on transient refresh failures.

## Migrating from 0.1.x

What changed:

- `connectWithQr()` runs browser-site sign-in against
  `https://orbapi.xyz/init-site-sign-in` and `/poll-site-sign-in`. Same name,
  same `{ signal, onInit }` shape.
- `onInit` now receives `{ qrCode, deepLink, expiresAt }`. `deepLink` is always
  present.
- The result is `{ processed, source, user_id, idToken, accessToken, expiresAt }`.
  `refreshToken` and `authenticationId` are gone.
- The attempt runs until the approval expires (~5 minutes). Per-call
  `timeoutMs` is gone; abort with `signal`.
- Removed options (TypeScript errors, and a `QrLegacyFlowError` at runtime):
  config `initUrl`, `pollUrl`, `credentials`, `headers`, `timeoutMs`,
  `initTimeoutMs`, `pollTimeoutMs`, `parseInitResponse`, `parsePollResponse`;
  call options `credentials`, `headers`, `timeoutMs`, `pollIntervalMs`.
- `createQrInitRequest`, `createQrPollRequest`, `parseQrInitResponse` and
  `parseQrPollResponse` still exist so imports keep compiling, but always throw
  `QrLegacyFlowError`. They will be removed in the next minor.
- `createOrbLogin().refresh()` always rejects (`AUTH_REFRESH_UNSUPPORTED`).

What to do:

1. Delete any server route that proxied `/init-sign-in` or `/poll-sign-in`
   (for example `/api/qr/init`, `/api/qr/poll`, `/api/auth/qr/*`) and the
   client code that called it. Call `connectWithQr()` from the browser.
2. Remove the legacy config from `qrAuthPlugin(...)` / `createOrbLogin({ qr })`.
   The defaults are correct for production.
3. Serve `/.well-known/orb-siwo.json` for your production origin and check an
   SPA fallback does not shadow it.
4. Add `https://orbapi.xyz` to CSP `connect-src`.
5. Delete refresh-token logic. Store `expiresAt`, end the session with
   `watchSessionExpiry` (or your own timer), and re-prompt sign-in.
6. Remove legacy sign-in env vars and secrets from code, docs and hosting:
   requestor secrets, `ORB_SIWO_KEY_ID`, `ORB_SIWO_PRIVATE_JWK`,
   `ORB_SIWO_ENABLED`, `QR_INIT_URL`, `QR_POLL_URL`. Browser-site sign-in needs
   no key or secret.
7. On touch devices show an "Open Orb app" link to `deepLink` next to the QR
   (`prefersDeepLink()`).
