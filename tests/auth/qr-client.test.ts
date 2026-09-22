import { afterEach, describe, expect, test, vi } from "vitest";

import { authPlugin } from "../../src/auth/plugin";
import {
  createQrInitRequest,
  type QrAuthError,
  type QrAuthPluginConfig,
  QrCancelledError,
  type QrConnectOptions,
  QrLegacyFlowError,
  QrProvisioningError,
  QrRequestError,
  QrResponseError,
  QrTimeoutError,
  qrAuthPlugin,
} from "../../src/auth/qr";
import { createSDK } from "../../src/index";
import { ADDRESS, approved, failed, pending, provisioning, ready, SESSION } from "./fixtures";

type Fetch = typeof globalThis.fetch;

// Web Crypto resolves outside the timer queue; fake only what the flow schedules.
const FAKE_TIMERS = { toFake: ["setTimeout", "clearTimeout", "Date"] as const };

function sdkWith(fetch: Fetch, config: QrAuthPluginConfig = {}) {
  return createSDK({
    fetch,
    plugins: [authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }), qrAuthPlugin(config)],
  });
}

/** Lets the real-time PKCE digest finish so the first request is made before fake time moves. */
async function untilCalled(fetch: ReturnType<typeof vi.fn<Fetch>>): Promise<void> {
  while (fetch.mock.calls.length === 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function bodyOf(fetch: ReturnType<typeof vi.fn<Fetch>>, call: number): Record<string, string> {
  return JSON.parse(String(fetch.mock.calls[call]?.[1]?.body));
}

describe("qrAuthPlugin (browser-site Sign in with Orb)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("runs init then poll against orbapi.xyz with PKCE and CORS-safe fetch options", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValueOnce(ready()).mockResolvedValueOnce(approved());
    const onInit = vi.fn();

    const result = await sdkWith(fetch).auth.connectWithQr({ onInit });

    expect(result).toEqual({
      processed: true,
      source: "lens",
      user_id: ADDRESS,
      idToken: expect.any(String),
      accessToken: expect.any(String),
      expiresAt: 4_102_444_800_000,
    });
    expect(fetch.mock.calls[0]?.[0]).toBe("https://orbapi.xyz/init-site-sign-in");
    expect(fetch.mock.calls[1]?.[0]).toBe("https://orbapi.xyz/poll-site-sign-in");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });

    const init = bodyOf(fetch, 0);
    const poll = bodyOf(fetch, 1);
    expect(Object.keys(init).sort()).toEqual(["codeChallenge", "state"]);
    expect(init.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(init.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(poll.session).toBe(SESSION);
    expect(poll.state).toBe(init.state);
    expect(poll.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(poll.codeVerifier),
    );
    expect(Buffer.from(digest).toString("base64url")).toBe(init.codeChallenge);

    expect(onInit).toHaveBeenCalledWith({
      qrCode: "data:image/png;base64,AAAA",
      deepLink: expect.stringMatching(/^orbapp:\/\/orb\/approve\?secret=/),
      expiresAt: expect.any(Number),
    });
    expect(onInit.mock.calls[0]?.[0]).not.toHaveProperty("session");
  });

  test("keeps polling through pending answers and transient faults", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(ready())
      .mockResolvedValueOnce(pending())
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(approved());

    const promise = sdkWith(fetch).auth.connectWithQr();
    await untilCalled(fetch);
    await vi.advanceTimersByTimeAsync(2_500 * 4);

    await expect(promise).resolves.toMatchObject({ processed: true, user_id: ADDRESS });
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  test("polls every 2.5s by default and never faster than 2s", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const fetch = vi.fn<Fetch>(async (input) =>
      String(input).endsWith("init-site-sign-in") ? ready() : pending(),
    );
    const controller = new AbortController();
    const promise = sdkWith(fetch, { pollIntervalMs: 100 }).auth.connectWithQr({
      signal: controller.signal,
    });
    const settled = promise.catch((error: unknown) => error);

    await untilCalled(fetch);
    await vi.advanceTimersByTimeAsync(10_000);
    // init + first poll + one poll per 2s
    expect(fetch).toHaveBeenCalledTimes(2 + 5);

    controller.abort();
    await expect(settled).resolves.toBeInstanceOf(QrCancelledError);
  });

  test("polls until expiresAt and then rejects as expired", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const expiresAt = Date.now() + 300_000;
    const fetch = vi.fn<Fetch>(async (input) =>
      String(input).endsWith("init-site-sign-in") ? ready(expiresAt) : pending(),
    );

    const settled = sdkWith(fetch)
      .auth.connectWithQr()
      .catch((error: unknown) => error);
    await untilCalled(fetch);
    await vi.advanceTimersByTimeAsync(299_000);
    expect(fetch.mock.calls.length).toBeGreaterThan(100);

    await vi.advanceTimersByTimeAsync(5_000);
    const error = await settled;
    expect(error).toBeInstanceOf(QrTimeoutError);
    expect((error as QrAuthError).reason).toBe("expired");
  });

  test("retries a provisioning origin, then shows the approval", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const onProvisioning = vi.fn();
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(provisioning())
      .mockResolvedValueOnce(provisioning())
      .mockResolvedValueOnce(ready(Date.now() + 600_000))
      .mockResolvedValueOnce(approved());

    const promise = sdkWith(fetch).auth.connectWithQr({ onProvisioning });
    await untilCalled(fetch);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(promise).resolves.toMatchObject({ processed: true });
    expect(onProvisioning).toHaveBeenCalledTimes(2);
  });

  test("gives up after the bounded provisioning attempts", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const fetch = vi.fn<Fetch>(async () => provisioning());

    const settled = sdkWith(fetch)
      .auth.connectWithQr()
      .catch((error: unknown) => error);
    await untilCalled(fetch);
    await vi.advanceTimersByTimeAsync(60_000);

    const error = await settled;
    expect(error).toBeInstanceOf(QrProvisioningError);
    expect((error as QrAuthError).reason).toBe("provisioning");
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  test("reports a FAILED init (missing or wrong manifest) as unavailable with a hint", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValueOnce(failed());

    const error = await sdkWith(fetch)
      .auth.connectWithQr()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(QrRequestError);
    expect(error).toMatchObject({ stage: "init", code: "QR_FAILED", reason: "unavailable" });
    expect((error as Error).message).toContain("/.well-known/orb-siwo.json");
  });

  test("does not retry a failed init transport", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValueOnce(new Response("down", { status: 502 }));

    await expect(sdkWith(fetch).auth.connectWithQr()).rejects.toMatchObject({
      stage: "init",
      status: 502,
      reason: "unavailable",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("stops polling when the backend answers FAILED", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(ready())
      .mockResolvedValueOnce(failed("Sign-in session not found"));

    await expect(sdkWith(fetch).auth.connectWithQr()).rejects.toMatchObject({
      name: "QrRequestError",
      stage: "poll",
      message: "Sign-in session not found",
    });
  });

  test.each([
    ["a bad session", { session: "nope" }],
    ["a legacy deep link", { deepLink: "orbapp://orb/sign-in" }],
    ["a missing qrCode", { qrCode: "" }],
    ["a non-integer expiresAt", { expiresAt: 1.5 }],
    ["an unknown phase", { phase: "WAITING" }],
  ])("rejects an approval with %s before showing it", async (_label, patch) => {
    const payload = await ready().json();
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(Response.json({ ...payload, data: { ...payload.data, ...patch } }));
    const onInit = vi.fn();

    await expect(sdkWith(fetch).auth.connectWithQr({ onInit })).rejects.toBeInstanceOf(
      QrResponseError,
    );
    expect(onInit).not.toHaveBeenCalled();
  });

  test.each([
    ["a refresh token", { refreshToken: "never-issued" }],
    ["a non-lens source", { source: "privy" }],
    ["a bad user_id", { user_id: "alice" }],
    ["a missing idToken", { idToken: undefined }],
    ["a blank accessToken", { accessToken: "" }],
  ])("rejects credentials with %s", async (_label, patch) => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(ready())
      .mockResolvedValueOnce(approved(patch));

    const error = await sdkWith(fetch)
      .auth.connectWithQr()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QrResponseError);
    expect((error as QrAuthError).reason).toBe("invalid");
  });

  test("cancels while waiting on an async onInit", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValueOnce(ready());
    const controller = new AbortController();

    const promise = sdkWith(fetch).auth.connectWithQr({
      signal: controller.signal,
      onInit: () => new Promise<void>(() => undefined),
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "QrCancelledError", reason: "cancelled" });
  });

  test("rejects a caller signal that is already aborted without calling the backend", async () => {
    const fetch = vi.fn<Fetch>();
    const controller = new AbortController();
    controller.abort();

    await expect(
      sdkWith(fetch).auth.connectWithQr({ signal: controller.signal }),
    ).rejects.toBeInstanceOf(QrCancelledError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("honors a custom https baseUrl and rejects unsafe ones", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValueOnce(ready()).mockResolvedValueOnce(approved());
    await sdkWith(fetch, { baseUrl: "https://signin.example.com/" }).auth.connectWithQr();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://signin.example.com/init-site-sign-in");

    for (const baseUrl of ["http://orbapi.xyz", "https://orbapi.xyz/api", "not a url"]) {
      await expect(sdkWith(fetch, { baseUrl }).auth.connectWithQr()).rejects.toMatchObject({
        code: "QR_CONFIG_INVALID",
        reason: "configuration",
      });
    }
  });

  test("fails loudly on legacy config and options instead of calling disabled endpoints", async () => {
    const fetch = vi.fn<Fetch>();
    const legacyConfig = { initUrl: "/api/qr/init", pollUrl: "/api/qr/poll" } as never;

    await expect(sdkWith(fetch, legacyConfig).auth.connectWithQr()).rejects.toThrow(
      /config\.initUrl, config\.pollUrl.*disabled/,
    );
    await expect(
      sdkWith(fetch).auth.connectWithQr({
        credentials: "id_access_refresh",
      } as never as QrConnectOptions),
    ).rejects.toBeInstanceOf(QrLegacyFlowError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("legacy proxy helpers throw a migration error", () => {
    expect(() => createQrInitRequest({ endpoint: "https://orbapi.xyz/init-sign-in" })).toThrow(
      QrLegacyFlowError,
    );
    const sdk = sdkWith(vi.fn<Fetch>());
    expect(() => sdk.auth.createQrPollRequest()).toThrow(/poll-sign-in\) is disabled/);
    expect(() => sdk.auth.parseQrPollResponse({})).toThrow(QrLegacyFlowError);
  });
});
