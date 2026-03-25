# Agent-First SDK Design

**Date:** 2026-03-25
**Scope:** Redesign the current public `orb-modules` package into a lean, SDK-first package for building apps on Orb and Lens primitives, while preserving modularity, tree-shaking, and long-term extensibility.

## Goal

Turn the current package from a small collection of helpers into a minimal but meaningful SDK that:

- gives developers and AI agents a fast happy path
- keeps the core package lean and tree-shakeable
- centers the package on auth/session primitives rather than a single backend
- allows optional integrations to plug in cleanly
- remains maintainable as new capabilities are added

The package should feel like "the fastest way to build on Orb/Lens primitives" rather than "a few internal utility files published publicly."

## Product Direction

The package should be:

- **SDK-first** for onboarding and happy-path usage
- **module-based underneath** for customization and future growth
- **plugin-driven from day one** so capabilities can evolve without reshaping the core
- **agent-first** in naming, docs, typing, and repo structure

This is not a class-heavy monolith. The root entrypoint should stay very small.

## Package Architecture

### Core

The root package should expose only the SDK core:

```ts
import { createSDK } from "<package>";
```

The root must remain minimal:

- no eager imports of optional plugins
- no framework runtime code
- no Orb-specific backend code
- no side effects

The core owns:

- plugin registration and composition
- shared config/runtime context
- common error utilities
- token/session primitives shared across auth flows
- type composition for installed plugins

### Root constructor

The host-level root API should be explicit:

```ts
const sdk = createSDK({
  plugins: [...],
  fetch,
  logger,
  runtime,
  defaults,
});
```

Proposed root options:

```ts
type CreateSDKOptions = {
  plugins: SDKPlugin<string, unknown>[];
  fetch?: typeof globalThis.fetch;
  logger?: {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  runtime?: "browser" | "server" | "edge" | "unknown";
  defaults?: {
    timeoutMs?: number;
  };
};
```

`SDKContext` is resolved by `createSDK()` from these host-level options and passed into each plugin `setup()`.

### Plugin entrypoints

Capabilities are added by explicit subpath imports:

```ts
import { authPlugin } from "<package>/auth";
import { qrAuthPlugin } from "<package>/auth/qr";
import { mediaPlugin } from "<package>/media";
import { groveUploadPlugin } from "<package>/upload/grove";
import { backendTransportPlugin } from "<package>/transport/backend";
```

This keeps the package lean while still providing a strong SDK story.

### SDK composition

The core composition model is plugin-first. The public shape is:

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({
      refreshUrl: "/api/auth/refresh",
      revokeUrl: "/api/auth/revoke",
    }),
    qrAuthPlugin({
      initUrl: "/api/qr/init",
      pollUrl: "/api/qr/poll",
    }),
    mediaPlugin({
      imageGateway: "https://cdn.example.com",
    }),
  ],
});
```

Each `authPlugin(...)` or `mediaPlugin(...)` call is a **plugin factory** that returns a plugin object. `createSDK()` accepts only plugin objects, not raw config.

Resulting SDK capabilities are typed and merged based on installed plugins.

## Core Principles

### 1. Auth-first, not backend-first

The package's center of gravity should be token/session management:

- token decoding
- expiry/refresh logic
- session refresh/revoke flows
- auth integrations such as QR

Optional backend API transport must not define the public package identity.

### 2. Lean by default

The package must remain small in both conceptual and bundle size terms:

- explicit plugin imports
- no root re-export barrels for optional plugins
- no framework UI code in the core
- no runtime feature registration magic

### 3. Flexible in every direction

The SDK should not assume:

- one backend
- one framework
- one auth transport
- one app architecture

Optional integrations can be added without forcing users onto a single model.

### 4. Agent-first and maintainable

The package should be easy for AI agents to discover and use:

- one obvious happy path
- small, well-bounded files
- config names based on function, not history
- strong TypeScript inference for plugin-composed capabilities
- docs designed for repo readers and package consumers

## Public API Shape

### Root API

The root export stays extremely small:

```ts
import { createSDK } from "<package>";
```

Root exports should include:

- `createSDK`
- core SDK types
- plugin typing helpers

Root exports should not include optional plugins.

### Capability namespaces

Each plugin contributes to exactly one top-level namespace to keep the surface predictable:

- `sdk.auth.*`
- `sdk.media.*`
- `sdk.upload.*`
- `sdk.transport.*`

This minimizes ambiguity for both developers and agents.

The namespace ownership rule is:

- a base plugin owns a namespace
- an extension plugin may add keys to an existing namespace
- extension plugins may not replace existing keys
- key collisions are a startup error

Example:

- `authPlugin(...)` owns `sdk.auth`
- `qrAuthPlugin(...)` extends `sdk.auth`
- if both define `sdk.auth.refresh`, `createSDK()` throws during initialization

Adapter helpers are not part of the v1 plugin namespace system. They ship later as direct framework-specific modules rather than composed SDK capabilities.

Concrete merge example:

```ts
const sdk = createSDK({
  plugins: [
    authPlugin({ refreshUrl: "/api/auth/refresh" }),
    qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll" }),
  ],
});

sdk.auth.refresh(...);
sdk.auth.connectWithQr(...);
```

`authPlugin` defines the base `sdk.auth` namespace. `qrAuthPlugin` extends that same namespace with additional non-conflicting methods.

## Plugin Contract

The plugin contract should be intentionally small:

```ts
type SDKPlugin<TNamespace extends string, TCapabilities> = {
  name: string;
  namespace: TNamespace;
  extends?: TNamespace;
  requires?: string[];
  setup: (context: SDKContext) => TCapabilities;
};
```

Design rules:

- plugin factories are pure and return `SDKPlugin`
- plugins are installed explicitly
- plugin config is validated inside the plugin factory
- runtime capability shape must match the TypeScript shape
- one plugin should map to one focused responsibility

Canonical public model:

- `authPlugin(config)` returns a plugin object
- `createSDK({ plugins: [...] })` accepts plugin objects
- `setup()` receives only shared SDK context, not raw user config

Lifecycle rules for v1:

- plugin setup is synchronous
- async work should happen inside returned methods, not during SDK construction
- teardown/dispose hooks are out of scope for v1
- plugin dependency ordering is explicit through array order
- `requires` is validation only; it does not auto-install or auto-order plugins

This is intentionally conservative to keep the first implementation lean.

Validation rules for v1:

- plugin `name` is the canonical unique identifier used by `requires`
- `namespace` is the top-level capability bucket a plugin owns or extends
- `extends` refers only to a namespace, never to a plugin name
- if a plugin lists `requires`, every required plugin name must already be installed
- if a dependency is missing, `createSDK()` throws a typed configuration error
- if an extension plugin is installed before its base namespace exists, `createSDK()` throws
- if an extension plugin targets a namespace that is never created, `createSDK()` throws
- if two plugins define the same final capability key, `createSDK()` throws
- there is no automatic dependency sorting or recovery

The shared SDK context should be minimal:

- fetch override support
- logging hooks
- timeout/cancellation helpers
- environment/runtime helpers
- shared error creation utilities

## Type System Direction

Plugins must extend the SDK's TypeScript surface so installed capabilities are discoverable through inference and autocomplete.

Desired outcome:

```ts
const sdk = createSDK({
  plugins: [authPlugin(...), qrAuthPlugin(...), mediaPlugin(...)],
});

sdk.auth.refresh(...);
sdk.auth.connectWithQr(...);
sdk.media.parse(...);
```

This improves:

- editor discoverability
- AI agent reliability
- self-documenting configuration and capability surfaces

The type system should be strong but not overly clever. Avoid a design that is hard for maintainers to reason about.

Type composition must mirror runtime rules:

- base plugins introduce a namespace
- extension plugins widen that namespace with additional non-conflicting keys
- collisions should fail in both type design and runtime validation where practical

## Initial v1 Plugin Set

### Ship in v1

- `auth`
  - token decode
  - expiry checks
  - refresh
  - revoke
  - session helpers
- `auth/qr`
  - QR init/poll/connect flow as an optional auth integration
  - framework-agnostic server helpers for implementing QR init/poll routes without Hono/Next-specific wrappers
- `media`
  - media categorization
  - protocol URL parsing
  - gateway-aware resolution
- `upload/grove`
  - Grove upload flow as an optional upload provider
- `transport/backend`
  - optional backend API transport

### Do not ship in core v1

- React state providers
- Preact state providers
- bridge / mini-app runtime
- generated Orb backend clients in the default public surface
- scaffolder / CLI

## v1.1 Focus

v1.1 expands ergonomics around server integrations and app setup.

**Planning boundary:** the first implementation plan should target **v1 only**. v1.1 items are roadmap context and must not be pulled into the initial implementation scope unless explicitly requested later.

### Add in v1.1

- `adapters/hono`
  - optional server helpers
  - direct module helpers
- `adapters/next`
  - optional server helpers
  - same direct-module model as Hono
- React state providers
  - separate entrypoint or separate package
- Preact state providers
  - same rule as React
- generated Orb backend clients
  - optional integration only, never part of the default public core story
- scaffolder / CLI
  - `npx create-orb-template`
  - minimal templates with explicit plugin installation

### v1.1 rules

- UI state must remain outside the core package
- generated backend clients must remain optional
- templates should stay small and only include the plugins they actually use
- Hono/Next adapters are direct framework modules in v1.1, not composed SDK plugins

## What To Bring In From orb-mini-sdk

Bring in design patterns, not Orb-mini-app assumptions.

### Bring in

- docs structure and discipline
  - `AGENTS.md`
  - `llms.txt`
  - focused Markdown docs under `docs/`
- explicit error taxonomy
- central SDK composition ideas
- typed transport/config patterns
- example-driven package ergonomics

### Do not bring in directly

- Orb bridge runtime
- mini-app context detection
- Orb-specific generated OpenAPI clients in the default public surface
- Orb-specific names and config conventions
- Orb mini-app scaffolding as the package identity

## Rename Direction

The public package should move away from Orb-specific naming for generic concepts.

Examples:

- `orb-auth` -> `auth`
- `orb-api` -> `transport/backend` or `api-client`
- `createOrbRoute` -> `createBackendRoute`
- `OrbApiConfig` -> `BackendTransportConfig`
- `API_BASE_URL` -> `BACKEND_BASE_URL`
- `ORB_ACCESS_TOKEN` -> `BACKEND_ACCESS_TOKEN`
- `ORB_APP_ORIGIN` -> `APP_ORIGIN`
- `ORB_QR_BASE_URL` -> `QR_BASE_URL`
- `ORB_MEDIA_GATEWAY` -> `MEDIA_GATEWAY`
- `ORB_AUDIO_GATEWAY` -> `AUDIO_GATEWAY`
- `ORB_POST_BASE_URL` -> `POST_BASE_URL`

Current unresolved naming must be fixed before planning:

- `orb-api` becomes `transport/backend`

Migration policy:

- this redesign is a **breaking major**
- no compatibility shims or deprecated aliases are kept
- current public imports are removed in favor of the new names
- package rename is deferred; the first implementation may keep the existing npm package name while changing the internal public API surface

## Documentation Strategy

The repo must support both:

- GitHub readers
- package consumers

Required baseline docs:

- `README.md`
- `AGENTS.md`
- `llms.txt`
- `docs/getting-started.md`
- `docs/auth.md`
- `docs/configuration.md`
- `docs/errors.md`

Each plugin should eventually have:

- one focused doc page
- one small example
- one clear capability section in `llms.txt`

## Runtime Support Matrix

The runtime target for each subsystem must be explicit.

### Core runtime

- `createSDK` core: universal JavaScript runtime
- no direct dependency on `window`, `File`, `XMLHttpRequest`, or framework globals
- shared network behavior should rely on configurable `fetch`

### Plugin runtime targets

- `auth`: browser + server compatible
- `auth/qr`: mixed
  - client connect flow: browser
  - QR route helpers: framework-agnostic server/edge compatible helpers in v1
- `media`: browser + server compatible
- `upload/grove`: browser-only
- `transport/backend`: trusted environment by default; may be proxied by host apps
- `adapters/hono`: Hono server/edge runtime only in v1.1
- `adapters/next`: Next.js route runtime only in v1.1
- React/Preact state providers: client/framework-specific, outside core

This matrix should drive file boundaries and exports.

## Error Handling

Replace stringly-typed failure handling with explicit error classes where appropriate.

The public SDK should use **typed thrown errors** for operational failures instead of the current `{ ok, message, data }` result pattern.

Rules:

- async SDK methods throw typed errors on failure
- pure utility helpers may still return plain values such as `null`, booleans, or parsed objects
- adapter helpers may translate thrown errors into HTTP responses or result objects for framework usage
- the default SDK surface should not mix `{ ok }` result objects and thrown errors arbitrarily

This is a breaking change and part of the major-version redesign.

The public error taxonomy should be generic and capability-focused, for example:

- `AuthConfigurationError`
- `AuthConnectError`
- `AuthTimeoutError`
- `TransportError`
- `ApiClientError`
- `UploadError`

This improves maintainability, docs, and agent reliability.

## Testing Strategy

The implementation plan should include:

- tests for plugin composition
- compile-time type tests for plugin-composed capability inference
- runtime tests for plugin registration, namespace extension, and collision failure
- tests for auth/token/session utilities
- tests for QR flow behavior
- tests for media parsing and upload behavior
- tests for optional adapter integrations

Docs and examples should also be treated as part of the public API surface.

## Risks

- plugin typing can become too clever and hard to maintain
- keeping the SDK lean requires discipline around exports and side effects
- backend-specific logic could still creep into the core without strong boundaries
- UI/framework features could blur the package identity if not isolated

## Recommendation

Build a **lean, auth-centered, plugin-driven SDK** with:

- a tiny root entrypoint
- explicit plugin imports
- strong type composition
- optional backend and framework integrations
- clear agent-first documentation from the start

This gives users and AI agents a fast path to building real apps, while preserving modularity, maintainability, and room for future expansion.
