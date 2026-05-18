# Getting Started

## Install

```bash
bun add @orbclub/modules
```

## Canonical Setup

```ts
import { createOrbLogin } from "@orbclub/modules/auth";

const orb = createOrbLogin();

const session = await orb.connectWithQr({
  onInit: ({ qrCode, deepLink }) => {
    renderQrSignIn({ qrCode, deepLink });
  },
});
```

This creates:

- `orb.connectWithQr(...)`
- `orb.refresh(...)`
- `orb.revoke(...)`
- `orb.syncSession(...)`
- token expiry helpers

## Add Plugins As Needed

```ts
import { createSDK } from "@orbclub/modules";
import { mediaPlugin } from "@orbclub/modules/media";
import { groveUploadPlugin } from "@orbclub/modules/upload/grove";
import { backendTransportPlugin } from "@orbclub/modules/transport/backend";

const sdk = createSDK({
  plugins: [
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
- Orb login uses direct browser calls to Orb QR and Lens GraphQL by default.
- `upload/grove` needs browser upload APIs.
- `transport/backend` is best used in trusted app infrastructure.
