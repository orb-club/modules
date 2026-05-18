# Errors

## Core

- `SDKError`
- `SDKConfigurationError`
- `SDKPluginCollisionError`

Core errors come from `@orbclub/modules`.

## Auth

From `@orbclub/modules/auth`:

- `AuthError`
- `AuthSessionError`
- `AuthRequestError`

From `@orbclub/modules/auth/qr`:

- `QrAuthError`
- `QrRequestError`
- `QrResponseError`
- `QrTimeoutError`
- `QrCancelledError`

## Upload

From `@orbclub/modules/upload/grove`:

- `GroveUploadError`
- `GroveUploadEnvironmentError`
- `GroveUploadRequestError`
- `GroveUploadPropagationError`

## Transport

From `@orbclub/modules/transport/backend`:

- `BackendTransportError`
- `BackendTransportConfigError`
- `BackendTransportRequestError`

## Guidance

- Catch plugin-specific error classes at the boundary where you call the plugin capability.
- Use the core SDK errors for plugin registration or configuration failures.
- Prefer typed errors over string matching in app code.
