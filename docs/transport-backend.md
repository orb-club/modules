# Transport: Backend

Import:

```ts
import { backendTransportPlugin } from "@orb-club/modules/transport/backend";
```

`backendTransportPlugin(...)` adds `sdk.transport.call(...)`.

This plugin is intentionally small. It is a generic JSON caller, not a generated client and not an app-specific route layer.

Config:

- `baseUrl`
- `timeoutMs`
- `headers`
- `serviceCredential`
- `accessToken`

Example:

```ts
const sdk = createSDK({
  plugins: [
    backendTransportPlugin({
      baseUrl: "https://api.example.com",
      serviceCredential: {
        header: "x-service-token",
        value: "server-secret",
      },
      accessToken: {
        header: "authorization",
        prefix: "Bearer ",
      },
    }),
  ],
});

const result = await sdk.transport.call(
  "/posts",
  { content: "gm" },
  { accessToken: "user-access-token" },
);
```

Notes:

- `path` must be relative to the configured `baseUrl`
- non-2xx responses throw `BackendTransportRequestError`
- invalid transport config throws `BackendTransportConfigError`
