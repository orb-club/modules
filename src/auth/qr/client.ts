/**
 * Browser-site Sign in with Orb, run in the page.
 *
 * 1. `POST {base}/init-site-sign-in {state, codeChallenge}` (PKCE S256). The
 *    browser's `Origin` header identifies the site; the backend checks it
 *    against the site's `/.well-known/orb-siwo.json` manifest and answers CORS
 *    for it. A first-use origin answers `phase: PROVISIONING` for a while.
 * 2. Show the approval (`qrCode` / `deepLink`) until `expiresAt`.
 * 3. `POST {base}/poll-site-sign-in {session, state, codeVerifier}` until the
 *    viewer approves or the approval expires.
 *
 * It must run in the browser: the backend rate-limits these endpoints per
 * client IP (12 inits and 120 polls a minute), so proxying through a shared
 * server address would throttle every viewer together. The result is an id
 * token and an access token (~10 minutes) and never a refresh token.
 */
import {
  DEFAULT_ORB_SIGN_IN_BASE_URL,
  ORB_SITE_SIGN_IN_INIT_PATH,
  ORB_SITE_SIGN_IN_POLL_PATH,
} from "../defaults";
import { getTokenExpiry } from "../token";
import { legacyOptionError } from "./legacy";
import {
  type QrAuthContext,
  QrAuthError,
  type QrAuthPluginConfig,
  QrCancelledError,
  type QrConnectOptions,
  type QrConnectResult,
  QrProvisioningError,
  QrRequestError,
  QrResponseError,
  type QrSignInApproval,
  QrTimeoutError,
} from "./types";

const DEFAULT_POLL_INTERVAL_MS = 2_500;
/** The backend allows 30 polls a minute per session. */
const MIN_POLL_INTERVAL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_PROVISIONING_RETRY_MS = 10_000;
const DEFAULT_PROVISIONING_ATTEMPTS = 6;
const MAX_TOKEN_LENGTH = 16_384;
const MAX_MESSAGE_LENGTH = 200;

const SESSION_PATTERN = /^[0-9a-f]{64}$/;
const DEEP_LINK_PATTERN = /^orbapp:\/\/orb\/approve\?secret=[0-9a-f]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const LEGACY_CONFIG_KEYS = [
  "initUrl",
  "pollUrl",
  "credentials",
  "headers",
  "timeoutMs",
  "initTimeoutMs",
  "pollTimeoutMs",
  "parseInitResponse",
  "parsePollResponse",
] as const;
const LEGACY_OPTION_KEYS = ["credentials", "headers", "timeoutMs", "pollIntervalMs"] as const;

type Stage = "init" | "poll";
type JsonObject = Record<string, unknown>;

/** Transport and server faults (network, timeout, 5xx, 429, non-JSON), as opposed to an answer. */
class TransientFailure extends Error {
  status?: number;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function configurationError(message: string, options?: ErrorOptions): QrAuthError {
  return new QrAuthError(message, "QR_CONFIG_INVALID", "configuration", options);
}

function assertNoLegacyKeys(
  source: object | undefined,
  keys: readonly string[],
  prefix: string,
): void {
  if (!source) {
    return;
  }

  const used = keys.filter((key) => (source as JsonObject)[key] !== undefined);
  if (used.length > 0) {
    throw legacyOptionError(used.map((key) => `${prefix}${key}`));
  }
}

function resolveBaseUrl(value: string | undefined): string {
  const raw = value ?? DEFAULT_ORB_SIGN_IN_BASE_URL;
  let url: URL;

  try {
    url = new URL(raw);
  } catch (error) {
    throw configurationError("Sign in with Orb baseUrl is not a valid URL.", { cause: error });
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw configurationError("Sign in with Orb baseUrl must be an https origin with no path.");
  }

  return url.origin;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getCrypto(): Crypto {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.getRandomValues || !cryptoImpl.subtle) {
    throw configurationError(
      "Sign in with Orb needs Web Crypto (crypto.getRandomValues and crypto.subtle).",
    );
  }

  return cryptoImpl;
}

function randomSecret(cryptoImpl: Crypto): string {
  return base64url(cryptoImpl.getRandomValues(new Uint8Array(32)));
}

async function challengeFor(cryptoImpl: Crypto, verifier: string): Promise<string> {
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function cancelled(signal: AbortSignal | undefined): QrCancelledError {
  return new QrCancelledError(undefined, { cause: signal?.reason });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw cancelled(signal);
  }
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(cancelled(signal));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);

  if (!signal) {
    return promise;
  }

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(cancelled(signal));

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function backendMessage(payload: unknown): string | undefined {
  if (isRecord(payload) && typeof payload.msg === "string") {
    const message = payload.msg.trim();
    if (message.length > 0 && message.length <= MAX_MESSAGE_LENGTH) {
      return message;
    }
  }

  return undefined;
}

async function post(
  context: QrAuthContext,
  url: string,
  stage: Stage,
  body: JsonObject,
  requestTimeoutMs: number,
  signal?: AbortSignal,
): Promise<JsonObject> {
  throwIfAborted(signal);

  const timeout = context.createTimeoutSignal(requestTimeoutMs, signal);
  let response: Response;
  let payload: unknown;

  try {
    try {
      response = await context.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: timeout.signal,
        body: JSON.stringify(body),
      });
    } catch (error) {
      throwIfAborted(signal);
      throw new TransientFailure("Sign in with Orb is unreachable.", undefined, { cause: error });
    }

    throwIfAborted(signal);

    if (response.status >= 500 || response.status === 429) {
      throw new TransientFailure("Sign in with Orb is unavailable.", response.status);
    }

    try {
      payload = await response.json();
    } catch (error) {
      throwIfAborted(signal);
      throw new TransientFailure("Sign in with Orb answered with invalid JSON.", response.status, {
        cause: error,
      });
    }
  } finally {
    timeout.cancel();
  }

  if (!response.ok || !isRecord(payload) || payload.status !== "SUCCESS") {
    const hint =
      stage === "init"
        ? " Check that this site serves /.well-known/orb-siwo.json naming this exact origin."
        : "";

    throw new QrRequestError(
      stage,
      `${backendMessage(payload) ?? "Sign in with Orb is unavailable."}${hint}`,
      {
        code: isRecord(payload) && payload.status === "FAILED" ? "QR_FAILED" : undefined,
        status: response.status,
      },
    );
  }

  if (!isRecord(payload.data)) {
    throw new QrResponseError(stage, "Sign in with Orb answered without data.");
  }

  return payload.data;
}

function readApproval(data: JsonObject): { session: string; approval: QrSignInApproval } {
  const { phase, session, qrCode, deepLink, expiresAt } = data;

  // Only a complete, well-formed approval is shown: a malformed one is an
  // outage, never a QR a viewer might scan into nothing.
  if (
    phase !== "READY" ||
    typeof session !== "string" ||
    !SESSION_PATTERN.test(session) ||
    typeof deepLink !== "string" ||
    !DEEP_LINK_PATTERN.test(deepLink) ||
    typeof qrCode !== "string" ||
    qrCode.length === 0 ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(expiresAt)
  ) {
    throw new QrResponseError("init", "Sign in with Orb answered with an invalid approval.");
  }

  if (expiresAt <= Date.now()) {
    throw new QrTimeoutError();
  }

  return { session, approval: { qrCode, deepLink, expiresAt } };
}

function readCredentials(data: JsonObject): QrConnectResult {
  const { source, user_id: userId, idToken, accessToken, refreshToken } = data;
  const isToken = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0 && value.length <= MAX_TOKEN_LENGTH;

  // A refresh token is never issued by this protocol; its presence means this
  // is not the credential set the protocol defines.
  if (
    source !== "lens" ||
    typeof userId !== "string" ||
    !ADDRESS_PATTERN.test(userId) ||
    !isToken(idToken) ||
    !isToken(accessToken) ||
    refreshToken !== undefined
  ) {
    throw new QrResponseError("poll", "Sign in with Orb returned invalid credentials.");
  }

  return {
    processed: true,
    source: "lens",
    user_id: userId,
    idToken,
    accessToken,
    expiresAt: getTokenExpiry(accessToken)?.getTime() ?? null,
  };
}

async function start(
  context: QrAuthContext,
  config: QrAuthPluginConfig,
  baseUrl: string,
  body: JsonObject,
  requestTimeoutMs: number,
  options: QrConnectOptions | undefined,
): Promise<JsonObject> {
  const signal = options?.signal;
  const attempts = Math.floor(positive(config.provisioningAttempts, DEFAULT_PROVISIONING_ATTEMPTS));
  const retryMs = positive(config.provisioningRetryMs, DEFAULT_PROVISIONING_RETRY_MS);

  for (let attempt = 1; ; attempt += 1) {
    let data: JsonObject;

    try {
      data = await post(
        context,
        `${baseUrl}${ORB_SITE_SIGN_IN_INIT_PATH}`,
        "init",
        body,
        requestTimeoutMs,
        signal,
      );
    } catch (error) {
      if (error instanceof TransientFailure) {
        throw new QrRequestError("init", error.message, { status: error.status, cause: error });
      }

      throw error;
    }

    if (data.phase !== "PROVISIONING") {
      return data;
    }

    if (attempt >= attempts) {
      throw new QrProvisioningError();
    }

    if (options?.onProvisioning) {
      await awaitWithAbort(Promise.resolve(options.onProvisioning()), signal);
    }

    await delay(retryMs, signal);
  }
}

/**
 * Runs one browser-site Sign in with Orb attempt and resolves with the
 * viewer's Lens credentials. Rejects with a `QrAuthError` whose `reason` says
 * why it ended (`expired`, `cancelled`, `unavailable`, `provisioning`,
 * `invalid`, `configuration`).
 */
export async function connectWithQr(
  context: QrAuthContext,
  config: QrAuthPluginConfig,
  options?: QrConnectOptions,
): Promise<QrConnectResult> {
  assertNoLegacyKeys(config, LEGACY_CONFIG_KEYS, "config.");
  assertNoLegacyKeys(options, LEGACY_OPTION_KEYS, "options.");

  const baseUrl = resolveBaseUrl(config.baseUrl);
  const signal = options?.signal;
  const requestTimeoutMs = positive(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
  const pollIntervalMs = Math.max(
    MIN_POLL_INTERVAL_MS,
    positive(config.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS),
  );

  throwIfAborted(signal);

  const cryptoImpl = getCrypto();
  const state = randomSecret(cryptoImpl);
  const codeVerifier = randomSecret(cryptoImpl);
  const codeChallenge = await challengeFor(cryptoImpl, codeVerifier);

  const started = await start(
    context,
    config,
    baseUrl,
    { state, codeChallenge },
    requestTimeoutMs,
    options,
  );
  const { session, approval } = readApproval(started);

  if (options?.onInit) {
    await awaitWithAbort(Promise.resolve(options.onInit(approval)), signal);
  }

  // Poll for the approval's whole lifetime, not an arbitrary client timeout:
  // a scan late in the window still signs the viewer in.
  for (;;) {
    throwIfAborted(signal);

    if (Date.now() >= approval.expiresAt) {
      throw new QrTimeoutError();
    }

    let data: JsonObject;
    try {
      data = await post(
        context,
        `${baseUrl}${ORB_SITE_SIGN_IN_POLL_PATH}`,
        "poll",
        { session, state, codeVerifier },
        requestTimeoutMs,
        signal,
      );
    } catch (error) {
      if (error instanceof TransientFailure) {
        await delay(Math.min(pollIntervalMs, Math.max(0, approval.expiresAt - Date.now())), signal);
        continue;
      }

      throw error;
    }

    if (data.processed === true) {
      return readCredentials(data);
    }

    if (data.processed !== false) {
      throw new QrResponseError("poll", "Sign in with Orb answered with an invalid poll state.");
    }

    await delay(Math.min(pollIntervalMs, Math.max(0, approval.expiresAt - Date.now())), signal);
  }
}

/**
 * True on touch-first devices, where the viewer cannot scan their own screen
 * and should be offered an "Open Orb app" link to `deepLink` next to the QR.
 */
export function prefersDeepLink(): boolean {
  const { matchMedia } = globalThis as {
    matchMedia?: (query: string) => { matches: boolean };
  };
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}
