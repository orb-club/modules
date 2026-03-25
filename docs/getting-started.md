# Getting Started

## Install

```bash
bun add @orb-club/modules
```

## Canonical Setup

```ts
import { createSDK } from "@orb-club/modules";
import { authPlugin } from "@orb-club/modules/auth";
import { qrAuthPlugin } from "@orb-club/modules/auth/qr";
import { mediaPlugin } from "@orb-club/modules/media";

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
    mediaPlugin({
      imageGateway: "https://cdn.example.com",
      audioGateway: "https://audio.example.com",
    }),
  ],
});
```

This creates:

- `sdk.auth.refresh(...)`
- `sdk.auth.revoke(...)`
- `sdk.auth.connectWithQr(...)`
- `sdk.media.parse(...)`
- `sdk.media.parseImage(...)`

## Add Plugins As Needed

```ts
import { groveUploadPlugin } from "@orb-club/modules/upload/grove";
import { backendTransportPlugin } from "@orb-club/modules/transport/backend";

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
    mediaPlugin(),
    groveUploadPlugin({
      apiUrl: "https://api.grove.storage",
    }),
    backendTransportPlugin({
      baseUrl: "https://api.example.com",
    }),
  ],
});
```

## Runtime Notes

- The package does not register plugins automatically.
- The package does not read environment variables directly.
- `upload/grove` needs browser upload APIs.
- `transport/backend` is best used in trusted app infrastructure.
