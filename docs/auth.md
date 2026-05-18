# Auth

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

Common config:

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

const session = await sdk.auth.connectWithQr({
  onInit: ({ qrCode, deepLink }) => {
    renderQrSignIn({ qrCode, deepLink });
  },
});
```

`connectWithQr(...)` resolves when polling returns `processed: true` with a
non-blank `accessToken`. `idToken`, `refreshToken`, and `authenticationId` are
preserved when the provider returns them, but they are not required for a
successful QR sign-in result.

## `lensAuthPlugin`

Import:

```ts
import { lensAuthPlugin } from "@orbclub/modules/auth/lens";
```

`lensAuthPlugin` extends `sdk.auth`. Install `authPlugin(...)` first.

Common config:

- `graphqlUrl`
- `headers`
- `timeoutMs`

Capabilities added to `sdk.auth`:

- `refreshLensSession({ refreshToken }, options?)`
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

- `auth` is transport-agnostic and centered on session lifecycle.
- `auth/qr` is an optional login transport.
- `auth/lens` is an optional Lens GraphQL refresh transport.
- UI state is not part of the core package.
