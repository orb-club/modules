import { describe, expect, test, vi } from "vitest";

import { createSDK } from "../../src/index";
import {
  BackendTransportConfigError,
  type BackendTransportRequestError,
  backendTransportPlugin,
} from "../../src/transport/backend/index";

describe("backendTransportPlugin", () => {
  test("calls relative paths against the configured base URL", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const sdk = createSDK({
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com/v1/" })],
    });

    await expect(
      sdk.transport.call("/users/me", {
        includeProfile: true,
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/users/me",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          includeProfile: true,
        }),
      }),
    );
  });

  test("injects configured service credentials and forwards per-user access tokens", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const sdk = createSDK({
      fetch,
      plugins: [
        backendTransportPlugin({
          baseUrl: "https://api.example.com",
          serviceCredential: {
            header: "x-service-token",
            value: "service-secret",
          },
          accessToken: {
            header: "authorization",
            prefix: "Bearer ",
          },
          headers: {
            "x-sdk-client": "orb-modules-test",
          },
        }),
      ],
    });

    await sdk.transport.call(
      "/posts",
      {
        content: "gm",
      },
      {
        accessToken: "user-token",
        headers: {
          "x-request-id": "req-123",
        },
      },
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/posts",
      expect.objectContaining({
        headers: {
          "content-type": "application/json",
          "x-sdk-client": "orb-modules-test",
          "x-request-id": "req-123",
          "x-service-token": "service-secret",
          authorization: "Bearer user-token",
        },
      }),
    );
  });

  test("normalizes header names and preserves caller-provided content types", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const sdk = createSDK({
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
    });

    await sdk.transport.call(
      "/posts",
      { content: "gm" },
      {
        headers: {
          "Content-Type": "application/merge-patch+json",
        },
      },
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/posts",
      expect.objectContaining({
        headers: {
          "content-type": "application/merge-patch+json",
        },
      }),
    );
  });

  test("throws a typed request error for failed backend responses", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "Backend rejected the request." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const sdk = createSDK({
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
    });

    await expect(
      sdk.transport.call("/posts", { content: "gm" }),
    ).rejects.toMatchObject<BackendTransportRequestError>({
      name: "BackendTransportRequestError",
      status: 401,
      message: "Backend rejected the request.",
    });
  });

  test("throws typed request errors when timed out requests abort", async () => {
    vi.useFakeTimers();

    const fetch = vi.fn<typeof globalThis.fetch>((_, init) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        });
      });
    });

    const sdk = createSDK({
      defaults: { timeoutMs: 10 },
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
    });

    const promise = sdk.transport.call("/posts", { content: "gm" });
    const rejection = expect(promise).rejects.toMatchObject<BackendTransportRequestError>({
      name: "BackendTransportRequestError",
      code: "BACKEND_TRANSPORT_TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(10);
    await rejection;

    vi.useRealTimers();
  });

  test("throws typed request errors for network failures", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("socket closed"));

    const sdk = createSDK({
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
    });

    await expect(
      sdk.transport.call("/posts", { content: "gm" }),
    ).rejects.toMatchObject<BackendTransportRequestError>({
      name: "BackendTransportRequestError",
      code: "BACKEND_TRANSPORT_REQUEST",
    });
  });

  test("throws a typed config error for invalid base URLs", async () => {
    const sdk = createSDK({
      fetch: vi.fn<typeof globalThis.fetch>(),
      plugins: [backendTransportPlugin({ baseUrl: "   " })],
    });

    await expect(sdk.transport.call("/posts", { content: "gm" })).rejects.toBeInstanceOf(
      BackendTransportConfigError,
    );
  });

  test("throws a typed config error for non-http backend base URLs", async () => {
    const sdk = createSDK({
      fetch: vi.fn<typeof globalThis.fetch>(),
      plugins: [backendTransportPlugin({ baseUrl: "ftp://api.example.com" })],
    });

    await expect(sdk.transport.call("/posts", { content: "gm" })).rejects.toBeInstanceOf(
      BackendTransportConfigError,
    );
  });

  test("throws a typed config error for invalid backend header names and values", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const sdk = createSDK({
      fetch,
      plugins: [
        backendTransportPlugin({
          baseUrl: "https://api.example.com",
          headers: {
            "bad header": "value",
          },
        }),
      ],
    });

    await expect(sdk.transport.call("/posts", { content: "gm" })).rejects.toBeInstanceOf(
      BackendTransportConfigError,
    );

    const valueSdk = createSDK({
      fetch,
      plugins: [
        backendTransportPlugin({
          baseUrl: "https://api.example.com",
          serviceCredential: {
            header: "x-service-token",
            value: "secret\nnext",
          },
        }),
      ],
    });

    await expect(valueSdk.transport.call("/posts", { content: "gm" })).rejects.toBeInstanceOf(
      BackendTransportConfigError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("throws a typed config error for non-relative paths", async () => {
    const sdk = createSDK({
      fetch: vi.fn<typeof globalThis.fetch>(),
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
    });

    await expect(sdk.transport.call("data:application/json,{}", {})).rejects.toBeInstanceOf(
      BackendTransportConfigError,
    );
  });

  test("throws a typed config error when paths escape the configured base URL path", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const sdk = createSDK({
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com/v1/" })],
    });

    await expect(sdk.transport.call("../admin", {})).rejects.toBeInstanceOf(
      BackendTransportConfigError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("throws typed request errors for unserializable payloads", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const sdk = createSDK({
      fetch,
      plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
    });
    const payload = {
      value: 1n,
    };

    await expect(
      sdk.transport.call("/posts", payload),
    ).rejects.toMatchObject<BackendTransportRequestError>({
      name: "BackendTransportRequestError",
      code: "BACKEND_TRANSPORT_REQUEST",
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
