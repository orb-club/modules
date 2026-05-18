# Upload: Grove

Import:

```ts
import { groveUploadPlugin } from "@orbclub/modules/upload/grove";
```

`groveUploadPlugin(...)` adds `sdk.upload.uploadFile(...)`.

Runtime:

- browser-only
- requires `File`
- requires `FormData`
- requires `XMLHttpRequest`

Config:

- `apiUrl`
- `chainId`
- `aclTemplate`
- `propagationTimeoutMs`
- `pollIntervalMs`

Example:

```ts
const sdk = createSDK({
  plugins: [
    groveUploadPlugin({
      apiUrl: "https://api.grove.storage",
    }),
  ],
});

const result = await sdk.upload.uploadFile({
  file,
  account: "0x1234",
  onProgress: updateUploadProgress,
});
```

Result shape:

- `uri`
- `gatewayUrl`
- `storageKey`
