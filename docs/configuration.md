# Configuration

The package takes plain config objects. It does not read environment variables directly.

## Suggested App-Level Env Names

If your app prefers environment variables, resolve them in your host app and pass the values into plugin factories. These names are generic and map cleanly onto the current plugin set:

- `AUTH_REFRESH_URL`
- `AUTH_REVOKE_URL`
- `QR_INIT_URL`
- `QR_POLL_URL`
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

- `initUrl?: string`
- `pollUrl?: string`
- `credentials?: string`
- `headers?: Record<string, string>`
- `pollIntervalMs?: number`
- `timeoutMs?: number`
- `initTimeoutMs?: number`
- `pollTimeoutMs?: number`

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

## Canonical Composition

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
