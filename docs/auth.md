# Auth

## `createOrbLogin`

Import:

```ts
import { createOrbLogin } from "@orbclub/modules/auth";
```

Default usage:

```ts
const orb = createOrbLogin();
const qrImage = document.querySelector<HTMLImageElement>("#orb-qr");
const orbLink = document.querySelector<HTMLAnchorElement>("#orb-link");

const session = await orb.connectWithQr({
  onInit: ({ qrCode, deepLink }) => {
    if (qrImage) qrImage.src = qrCode;
    if (orbLink && deepLink) orbLink.href = deepLink;
  },
});

const nextSession = session.refreshToken
  ? await orb.refresh({ refreshToken: session.refreshToken })
  : session;
```

Defaults:

- QR init: `https://orbapi.xyz/init-sign-in`
- QR poll: `https://orbapi.xyz/poll-sign-in`
- QR credentials: `id_access_refresh`
- Lens GraphQL: `https://api.lens.xyz/graphql`
- QR poll interval: `2_000`

Capabilities:

- `connectWithQr(options?)`
- `refresh({ refreshToken }, options?)`
- `revoke({ authenticationId, accessToken }, options?)`
- `syncSession(session, options?)`
- `getAccountFromAccessToken(token)`
- token and session expiry helpers

The default flow is browser-owned. It does not require app `/api/auth/*` proxy
routes. `createOrbLogin()` does not read or write browser storage, and its
`onInit` callback receives only the display-safe QR fields: `qrCode` and
`deepLink`.

## Lower-Level Plugins

## `authPlugin`

Import:

```ts
import { authPlugin } from "@orbclub/modules/auth";
```

Required config:

- `refreshUrl`
- `revokeUrl`

Optional config:

- `timeoutMs`
- `headers`

Capabilities added to `sdk.auth`:

- `decodeToken(token)`
- `getTokenExpiry(token)`
- `isTokenExpired(token, bufferSeconds?)`
- `tokenExpiresWithin(token, seconds)`
- `getSessionExpiry(session)`
- `isSessionStale(session, maxAgeMs)`
- `shouldRefreshSession(session, refreshWindowSeconds)`
- `refresh({ refreshToken, authenticationId? }, options?)`
- `revoke({ authenticationId, accessToken }, options?)`

Example:

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({
      refreshUrl: "/api/auth/refresh",
      revokeUrl: "/api/auth/revoke",
    }),
  ],
});

const session = await sdk.auth.refresh({
  refreshToken: currentSession.refreshToken,
});
```

## `qrAuthPlugin`

Import:

```ts
import { qrAuthPlugin } from "@orbclub/modules/auth/qr";
```

`qrAuthPlugin` extends `sdk.auth`. Install `authPlugin(...)` first.

Default config:

- `initUrl`: `https://orbapi.xyz/init-sign-in`
- `pollUrl`: `https://orbapi.xyz/poll-sign-in`
- `credentials`: `id_access_refresh`
- `pollIntervalMs`: `2_000`

Common overrides:

- `initUrl`
- `pollUrl`
- `credentials`
- `headers`
- `pollIntervalMs`
- `timeoutMs`
- `initTimeoutMs`
- `pollTimeoutMs`

Capabilities added to `sdk.auth`:

- `connectWithQr(options?)`
- `createQrInitRequest(options)`
- `createQrPollRequest(options)`
- `parseQrInitResponse(payload)`
- `parseQrPollResponse(payload)`

Example:

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({
      refreshUrl: "/api/auth/refresh",
      revokeUrl: "/api/auth/revoke",
    }),
    qrAuthPlugin({
      initUrl: "/api/auth/qr/init",
      pollUrl: "/api/auth/qr/poll",
      pollIntervalMs: 2_000,
    }),
  ],
});

const qrImage = document.querySelector<HTMLImageElement>("#orb-qr");
const orbLink = document.querySelector<HTMLAnchorElement>("#orb-link");

const session = await sdk.auth.connectWithQr({
  onInit: ({ qrCode, deepLink }) => {
    if (qrImage) qrImage.src = qrCode;
    if (orbLink && deepLink) orbLink.href = deepLink;
  },
});
```

`connectWithQr(...)` resolves when polling returns `processed: true` with a
non-blank `accessToken`. `idToken`, `refreshToken`, and `authenticationId` are
preserved when the provider returns them, but they are not required for a
successful QR sign-in result.

The lower-level QR plugin exposes the parsed init payload, including the
polling `secret`, for custom transports. Treat that payload as sensitive.

## `lensAuthPlugin`

Import:

```ts
import { lensAuthPlugin } from "@orbclub/modules/auth/lens";
```

`lensAuthPlugin` extends `sdk.auth`. Install `authPlugin(...)` first.

Default config:

- `graphqlUrl`: `https://api.lens.xyz/graphql`

Common overrides:

- `graphqlUrl`
- `headers`
- `timeoutMs`

Capabilities added to `sdk.auth`:

- `refreshLensSession({ refreshToken }, options?)`
- `revokeLensSession({ authenticationId, accessToken }, options?)`
- `syncLensSession(session, options?)`
- `getLensAccountFromAccessToken(token)`

`refreshLensSession(...)` requires a non-blank `refreshToken` and a Lens
`AuthenticationTokens` response with a non-blank `accessToken`.

`syncLensSession(...)` keeps fresh sessions unchanged, refreshes sessions inside
the refresh window, returns `null` for Lens `ForbiddenError` responses, and
keeps the hydrated session on transient refresh failures.

Example:

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({
      refreshUrl: "/api/auth/refresh",
      revokeUrl: "/api/auth/revoke",
    }),
    lensAuthPlugin({
      graphqlUrl: "https://api.lens.xyz/graphql",
    }),
  ],
});

const session = await sdk.auth.syncLensSession({
  accessToken: currentLensSession.accessToken,
  refreshToken: currentLensSession.refreshToken,
});
```

## Current Scope

- `auth` exposes the browser-direct Orb login helper and lower-level session primitives.
- `auth/qr` is the lower-level QR login transport.
- `auth/lens` is the lower-level Lens GraphQL refresh/revoke transport.
- UI state is not part of the core package.
