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

- `QrAuthError` (base; `reason` is `expired`, `cancelled`, `unavailable`, `provisioning`, `invalid` or `configuration`)
- `QrRequestError` (`unavailable`: backend answered `FAILED`/4xx; on init usually a missing or wrong manifest)
- `QrResponseError` (`invalid`: response outside the protocol)
- `QrTimeoutError` (`expired`: the approval window passed)
- `QrCancelledError` (`cancelled`)
- `QrProvisioningError` (`provisioning`: first-use setup still running)
- `QrLegacyFlowError` (`configuration`: a removed 0.1.x option or helper was used)

`createOrbLogin().refresh()` rejects with `AuthSessionError` code
`AUTH_REFRESH_UNSUPPORTED`: Sign in with Orb issues no refresh token.

From `@orbclub/modules/auth/site`:

- `SiwoManifestConfigError` (thrown when a manifest handler is created with an invalid origin)

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
