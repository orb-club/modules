# Auth

## `authPlugin`

Import:

```ts
import { authPlugin } from "@orb-club/modules/auth";
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
  refreshToken: "refresh-token",
});
```

## `qrAuthPlugin`

Import:

```ts
import { qrAuthPlugin } from "@orb-club/modules/auth/qr";
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
    console.log(qrCode, deepLink);
  },
});
```

## Current Scope

- `auth` is transport-agnostic and centered on session lifecycle.
- `auth/qr` is an optional login transport.
- UI state is not part of the core package.
