# Configuration

The default login path is `createOrbLogin()` with no config. It runs
browser-site Sign in with Orb against `https://orbapi.xyz` from the page.

The package still takes plain config objects for advanced composition. It does
not read environment variables directly.

## Login Defaults

```ts
import { createOrbLogin } from "@orbclub/modules/auth";

const orb = createOrbLogin();
```

Defaults:

- Sign-in API: `https://orbapi.xyz` (`/init-site-sign-in`, `/poll-site-sign-in`)
- Poll interval: `2_500` ms
- Per-request timeout: `10_000` ms
- Provisioning retries: `6` attempts, `10_000` ms apart
- Lens GraphQL: `https://api.lens.xyz/graphql`

## Suggested App-Level Env Names

If your app prefers environment variables for advanced overrides, resolve them
in your host app and pass the values into `createOrbLogin(...)` or plugin
factories. These names are generic and map cleanly onto the current plugin set:

- `AUTH_REFRESH_URL`
- `AUTH_REVOKE_URL`
- `APP_ORIGIN` (the https origin passed to `createSiwoManifestHandler`)
- `LENS_GRAPHQL_URL`
- `MEDIA_GATEWAY`
- `AUDIO_GATEWAY`
- `IPFS_GATEWAY`
- `ARWEAVE_GATEWAY`
- `LENS_GATEWAY`
- `GROVE_API_URL`
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN`

## Plugin Config Map

### `authPlugin(...)`

- `refreshUrl: string`
- `revokeUrl: string`
- `timeoutMs?: number`
- `headers?: Record<string, string>`

### `qrAuthPlugin(...)`

- `baseUrl?: string` default `https://orbapi.xyz`; must be an `https` origin with no path
- `pollIntervalMs?: number` default `2_500`; values below `2_000` are raised, invalid values use the default
- `requestTimeoutMs?: number` default `10_000`
- `provisioningRetryMs?: number` default `10_000`
- `provisioningAttempts?: number` default `6`

The 0.1.x options `initUrl`, `pollUrl`, `credentials`, `headers`, `timeoutMs`,
`initTimeoutMs`, `pollTimeoutMs`, `parseInitResponse` and `parsePollResponse`
are removed; passing any of them fails with `QrLegacyFlowError`.

### `createSiwoManifestHandler(...)` (`@orbclub/modules/auth/site`)

- `{ origin: string }`: the one https origin to serve, or
- `{ origins: string[] }`: an allow-list; the request `Host` picks the match

### `lensAuthPlugin(...)`

- `graphqlUrl?: string` default `https://api.lens.xyz/graphql`
- `timeoutMs?: number`
- `headers?: Record<string, string>`

### `mediaPlugin(...)`

- `imageGateway?: string`
- `audioGateway?: string`
- `ipfsGateway?: string`
- `arweaveGateway?: string`
- `lensGateway?: string`
- `defaultThumbnailDimension?: number`

### `groveUploadPlugin(...)`

- `apiUrl?: string`
- `chainId?: number`
- `aclTemplate?: string`
- `propagationTimeoutMs?: number`
- `pollIntervalMs?: number` positive finite milliseconds, invalid values use the default

### `backendTransportPlugin(...)`

- `baseUrl: string`
- `timeoutMs?: number`
- `headers?: Record<string, string>`
- `serviceCredential?: { header: string; value: string; prefix?: string }`
- `accessToken?: { header?: string; prefix?: string }`

## Advanced Composition

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({
      refreshUrl: "/api/auth/refresh",
      revokeUrl: "/api/auth/revoke",
    }),
    qrAuthPlugin(),
    mediaPlugin({
      imageGateway: "https://cdn.example.com",
    }),
  ],
});
```
