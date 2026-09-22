# Getting Started

## Install

```bash
npm install @orbclub/modules
```

## Canonical Setup

```ts
import { createOrbLogin } from "@orbclub/modules/auth";

const orb = createOrbLogin();
const qrImage = document.querySelector<HTMLImageElement>("#orb-qr");
const orbLink = document.querySelector<HTMLAnchorElement>("#orb-link");

const session = await orb.connectWithQr({
  onInit: ({ qrCode, deepLink }) => {
    if (qrImage) qrImage.src = qrCode;
    if (orbLink) {
      orbLink.href = deepLink;
      orbLink.hidden = !orb.prefersDeepLink();
    }
  },
});

orb.watchSessionExpiry(session.expiresAt, () => {
  // ~10 minutes later: clear the session and show "Sign in" again.
});
```

This creates:

- `orb.connectWithQr(...)`: browser-site Sign in with Orb, run in the page
- `orb.watchSessionExpiry(...)` and token expiry helpers
- `orb.prefersDeepLink()`
- `orb.syncSession(...)`, `orb.revoke(...)`

Then serve the opt-in manifest and allow the API in your CSP:

```ts
// app/.well-known/orb-siwo.json/route.ts (Next.js App Router)
import { createSiwoManifestHandler } from "@orbclub/modules/auth/site";

export const GET = createSiwoManifestHandler({ origin: "https://app.example.com" });
```

```
Content-Security-Policy: connect-src 'self' https://orbapi.xyz; img-src 'self' data:
```

See [auth.md](auth.md) for Hono, several domains, first-use provisioning,
rate limits and failure reasons.

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
- Sign in with Orb must run in the browser (the backend rate-limits per client IP) and only works on the https origin(s) your manifest names; preview deployments on other origins cannot sign in.
- Sessions last about 10 minutes and cannot be refreshed.
- `upload/grove` needs browser upload APIs.
- `transport/backend` is best used in trusted app infrastructure.
