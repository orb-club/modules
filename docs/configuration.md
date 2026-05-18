# Configuration

The default login path is `createOrbLogin()` with no config. It uses direct
browser calls to Orb QR and Lens GraphQL.

The package still takes plain config objects for advanced composition. It does
not read environment variables directly.

## Login Defaults

```ts
import { createOrbLogin } from "@orbclub/modules/auth";

const orb = createOrbLogin();
```

Defaults:

- QR init: `https://orbapi.xyz/init-sign-in`
- QR poll: `https://orbapi.xyz/poll-sign-in`
- QR credentials: `id_access_refresh`
- Lens GraphQL: `https://api.lens.xyz/graphql`
- QR poll interval: `2_000`

## Suggested App-Level Env Names

If your app prefers environment variables for advanced overrides, resolve them
in your host app and pass the values into `createOrbLogin(...)` or plugin
factories. These names are generic and map cleanly onto the current plugin set:

- `AUTH_REFRESH_URL`
- `AUTH_REVOKE_URL`
- `QR_INIT_URL`
- `QR_POLL_URL`
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

- `initUrl?: string` default `https://orbapi.xyz/init-sign-in`
- `pollUrl?: string` default `https://orbapi.xyz/poll-sign-in`
- `credentials?: string`
- `headers?: Record<string, string>`
- `pollIntervalMs?: number`
- `timeoutMs?: number`
- `initTimeoutMs?: number`
- `pollTimeoutMs?: number`

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
- `pollIntervalMs?: number`

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
    qrAuthPlugin({
      initUrl: "/api/auth/qr/init",
      pollUrl: "/api/auth/qr/poll",
    }),
    mediaPlugin({
      imageGateway: "https://cdn.example.com",
    }),
  ],
});
```
