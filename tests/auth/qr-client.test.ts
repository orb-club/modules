import { afterEach, describe, expect, test, vi } from "vitest";

import { authPlugin } from "../../src/auth/plugin";
import { QrCancelledError, QrResponseError, QrTimeoutError, qrAuthPlugin } from "../../src/auth/qr";
import { createSDK } from "../../src/index";

describe("qrAuthPlugin", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("uses browser-direct Orb QR defaults without config", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            qrCode: "qr-code",
            secret: "secret-123",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "SUCCESS",
          data: {
            processed: true,
            accessToken: "access-token",
          },
        }),
      );

    const sdk = createSDK({
      fetch,
      plugins: [authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }), qrAuthPlugin()],
    });

    await expect(sdk.auth.connectWithQr()).resolves.toEqual(
      expect.objectContaining({
        processed: true,
        accessToken: "access-token",
      }),
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://orbapi.xyz/init-sign-in?credentials=id_access_refresh",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://orbapi.xyz/poll-sign-in",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("extends auth with QR helpers, sends init before polling, and exposes the init payload", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              qrCode: "data:image/png;base64,abc",
              secret: "secret-123",
              deepLink: "app://sign-in",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "SUCCESS",
            data: {
              processed: true,
              accessToken: "access-token",
              idToken: "id-token",
              refreshToken: "refresh-token",
            },
          }),
        ),
      );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll", pollIntervalMs: 1 }),
      ],
    });

    const onInit = vi.fn();
    const result = await sdk.auth.connectWithQr({ credentials: "id_access", onInit });

    expect(sdk.auth.createQrInitRequest).toBeTypeOf("function");
    expect(sdk.auth.createQrPollRequest).toBeTypeOf("function");
    expect(sdk.auth.parseQrInitResponse).toBeTypeOf("function");
    expect(sdk.auth.parseQrPollResponse).toBeTypeOf("function");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/qr/init?credentials=id_access",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/qr/poll",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ secret: "secret-123" }),
      }),
    );
    expect(onInit).toHaveBeenCalledWith(
      expect.objectContaining({
        qrCode: "data:image/png;base64,abc",
        secret: "secret-123",
        deepLink: "app://sign-in",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "SUCCESS",
        processed: true,
        accessToken: "access-token",
        idToken: "id-token",
        refreshToken: "refresh-token",
      }),
    );
  });

  test("keeps polling until a processed success response is returned", async () => {
    vi.useFakeTimers();

    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              data: {
                qrCode: "qr-code",
                secret: "secret-123",
              },
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "PENDING",
            data: {
              processed: false,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              status: "SUCCESS",
              data: {
                processed: true,
                accessToken: "access-token",
                idToken: "id-token",
              },
            },
          }),
        ),
      );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll", pollIntervalMs: 25 }),
      ],
    });

    const promise = sdk.auth.connectWithQr();

    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        status: "SUCCESS",
        processed: true,
        accessToken: "access-token",
        idToken: "id-token",
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("keeps polling when success status arrives before processing completes", async () => {
    vi.useFakeTimers();

    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              qrCode: "qr-code",
              secret: "secret-123",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "SUCCESS",
            data: {
              processed: false,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "SUCCESS",
            data: {
              processed: true,
              accessToken: "access-token",
            },
          }),
        ),
      );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll", pollIntervalMs: 25 }),
      ],
    });

    const promise = sdk.auth.connectWithQr();

    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        status: "SUCCESS",
        processed: true,
        accessToken: "access-token",
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("throws a timeout error when polling does not finish in time", async () => {
    vi.useFakeTimers();

    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              qrCode: "qr-code",
              secret: "secret-123",
            },
          }),
        ),
      )
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: "PENDING",
              data: {
                processed: false,
              },
            }),
          ),
      );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({
          initUrl: "/api/qr/init",
          pollUrl: "/api/qr/poll",
          pollIntervalMs: 25,
          timeoutMs: 60,
        }),
      ],
    });

    const promise = sdk.auth.connectWithQr();
    const rejection = expect(promise).rejects.toBeInstanceOf(QrTimeoutError);

    await vi.advanceTimersByTimeAsync(60);

    await rejection;
  });

  test("throws a cancellation error when the caller aborts the flow", async () => {
    vi.useFakeTimers();

    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              qrCode: "qr-code",
              secret: "secret-123",
            },
          }),
        ),
      )
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: "PENDING",
              data: {
                processed: false,
              },
            }),
          ),
      );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll", pollIntervalMs: 25 }),
      ],
    });

    const controller = new AbortController();
    const promise = sdk.auth.connectWithQr({ signal: controller.signal });
    const rejection = expect(promise).rejects.toBeInstanceOf(QrCancelledError);

    controller.abort(new Error("user cancelled"));
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
  });

  test("remains cancellable while an async onInit callback is pending", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            qrCode: "qr-code",
            secret: "secret-123",
          },
        }),
      ),
    );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll" }),
      ],
    });

    const controller = new AbortController();
    const promise = sdk.auth.connectWithQr({
      onInit: async () => await new Promise(() => undefined),
      signal: controller.signal,
    });

    controller.abort(new Error("user cancelled"));

    await expect(promise).rejects.toBeInstanceOf(QrCancelledError);
  });

  test("times out while an async onInit callback is pending", async () => {
    vi.useFakeTimers();

    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            qrCode: "qr-code",
            secret: "secret-123",
          },
        }),
      ),
    );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll" }),
      ],
    });

    const promise = sdk.auth.connectWithQr({
      timeoutMs: 20,
      onInit: () => new Promise<void>((resolve) => setTimeout(resolve, 100)),
    });
    const rejection = expect(promise).rejects.toBeInstanceOf(QrTimeoutError);

    await vi.advanceTimersByTimeAsync(20);

    await rejection;
  });

  test("throws a response error for terminal poll responses missing an access token", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              qrCode: "qr-code",
              secret: "secret-123",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "SUCCESS",
            data: {
              processed: true,
              idToken: "id-token",
            },
          }),
        ),
      );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll", pollIntervalMs: 1 }),
      ],
    });

    await expect(sdk.auth.connectWithQr()).rejects.toBeInstanceOf(QrResponseError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("throws a response error when a custom parser returns a blank access token", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({}));
    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({
          parseInitResponse: () => ({
            qrCode: "qr-code",
            secret: "secret-123",
            raw: {},
          }),
          parsePollResponse: () => ({
            processed: true,
            accessToken: "   ",
            raw: {},
          }),
        }),
      ],
    });

    await expect(sdk.auth.connectWithQr()).rejects.toBeInstanceOf(QrResponseError);
  });

  test("uses SDK default timeouts when QR-specific overrides are absent", async () => {
    vi.useFakeTimers();

    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              qrCode: "qr-code",
              secret: "secret-123",
            },
          }),
        ),
      )
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: "PENDING",
              data: {
                processed: false,
              },
            }),
          ),
      );

    const sdk = createSDK({
      defaults: { timeoutMs: 60 },
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        qrAuthPlugin({ initUrl: "/api/qr/init", pollUrl: "/api/qr/poll", pollIntervalMs: 25 }),
      ],
    });

    const promise = sdk.auth.connectWithQr();
    const rejection = expect(promise).rejects.toBeInstanceOf(QrTimeoutError);

    await vi.advanceTimersByTimeAsync(60);

    await rejection;
  });
});
