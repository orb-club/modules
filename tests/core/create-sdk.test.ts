import { describe, expect, test, vi } from "vitest";

import { createSDK, SDKPluginCollisionError } from "../../src/index";

describe("createSDK", () => {
  test("returns a core object when no plugins are installed", () => {
    const sdk = createSDK({ plugins: [] });

    expect(sdk).toEqual({});
  });

  test("merges namespace extensions into the same capability bucket", () => {
    const sdk = createSDK({
      plugins: [
        {
          name: "auth",
          namespace: "auth",
          setup: () => ({
            refresh: () => "refreshed",
          }),
        },
        {
          name: "auth-qr",
          namespace: "auth",
          extends: "auth",
          requires: ["auth"],
          setup: () => ({
            connectWithQr: () => "connected",
          }),
        },
      ],
    });

    expect(sdk.auth.refresh()).toBe("refreshed");
    expect(sdk.auth.connectWithQr()).toBe("connected");
  });

  test("throws when two plugins define the same final capability key", () => {
    expect(() =>
      createSDK({
        plugins: [
          {
            name: "auth",
            namespace: "auth",
            setup: () => ({
              refresh: () => "base",
            }),
          },
          {
            name: "auth-qr",
            namespace: "auth",
            extends: "auth",
            requires: ["auth"],
            setup: () => ({
              refresh: () => "extension",
            }),
          },
        ],
      }),
    ).toThrowError(SDKPluginCollisionError);
  });

  test("does not let a dangerous namespace mutate Object.prototype", () => {
    const sdk = createSDK({
      plugins: [
        {
          name: "proto",
          namespace: "__proto__",
          setup: () => ({
            refresh: () => "safe",
          }),
        },
      ],
    });

    const prototypeBucket = Reflect.get(sdk, "__proto__") as { refresh: () => string };

    expect(prototypeBucket.refresh()).toBe("safe");
    expect(Object.hasOwn(Object.prototype, "refresh")).toBe(false);
    expect(({} as { refresh?: unknown }).refresh).toBeUndefined();
  });

  test("preserves an upstream abort reason when merging signals", () => {
    const reason = new Error("upstream stopped");

    const sdk = createSDK({
      plugins: [
        {
          name: "signals",
          namespace: "signals",
          setup: (context) => {
            const upstreamController = new AbortController();
            const timeoutController = new AbortController();

            const merged = context.mergeAbortSignals(
              upstreamController.signal,
              timeoutController.signal,
            );

            upstreamController.abort(reason);

            return {
              merged,
            };
          },
        },
      ],
    });

    expect(sdk.signals.merged?.aborted).toBe(true);
    expect(sdk.signals.merged?.reason).toBe(reason);
  });

  test("preserves the TimeoutError reason for timeout-backed merged signals", async () => {
    vi.useFakeTimers();

    try {
      const sdk = createSDK({
        plugins: [
          {
            name: "signals",
            namespace: "signals",
            setup: (context) => {
              const upstreamController = new AbortController();

              return {
                timeoutHandle: context.createTimeoutSignal(1, upstreamController.signal),
              };
            },
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(1);

      expect(sdk.signals.timeoutHandle.signal?.aborted).toBe(true);
      expect(sdk.signals.timeoutHandle.signal?.reason).toBeInstanceOf(DOMException);
      expect(sdk.signals.timeoutHandle.signal?.reason?.name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("removes upstream abort listeners when timeout handles are cancelled", () => {
    vi.useFakeTimers();

    try {
      const upstreamController = new AbortController();
      const addEventListener = vi.spyOn(upstreamController.signal, "addEventListener");
      const removeEventListener = vi.spyOn(upstreamController.signal, "removeEventListener");
      const sdk = createSDK({
        plugins: [
          {
            name: "signals",
            namespace: "signals",
            setup: (context) => ({
              timeoutHandle: context.createTimeoutSignal(100, upstreamController.signal),
            }),
          },
        ],
      });

      sdk.signals.timeoutHandle.cancel();

      expect(addEventListener).toHaveBeenCalledWith("abort", expect.any(Function), {
        once: true,
      });
      expect(removeEventListener).toHaveBeenCalledWith(
        "abort",
        addEventListener.mock.calls[0]?.[1],
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
