import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createSDK } from "../../src";
import {
  GroveUploadEnvironmentError,
  GroveUploadPropagationError,
  type GroveUploadRequestError,
  groveUploadPlugin,
} from "../../src/upload/grove";

class MockProgressTarget {
  listener?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void;

  addEventListener(
    type: "progress",
    listener: (event: { lengthComputable: boolean; loaded: number; total: number }) => void,
  ) {
    if (type === "progress") {
      this.listener = listener;
    }
  }
}

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  status = 200;
  responseText = "";
  method = "";
  url = "";
  sentEntries: Array<[string, string]> = [];
  upload = new MockProgressTarget();
  loadListener?: () => void;
  errorListener?: () => void;

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.sentEntries = Array.from(body.entries()).map(([key, value]) => [
      key,
      value instanceof File ? value.name : String(value),
    ]);

    this.upload.listener?.({ lengthComputable: true, loaded: 1, total: 2 });
    this.loadListener?.();
  }

  abort() {}

  addEventListener(type: "load" | "error", listener: () => void) {
    if (type === "load") {
      this.loadListener = listener;
      return;
    }

    this.errorListener = listener;
  }
}

describe("groveUploadPlugin", () => {
  const originalXhr = (
    globalThis as typeof globalThis & { XMLHttpRequest?: typeof MockXMLHttpRequest }
  ).XMLHttpRequest;

  beforeEach(() => {
    MockXMLHttpRequest.instances = [];
    (
      globalThis as typeof globalThis & { XMLHttpRequest?: typeof MockXMLHttpRequest }
    ).XMLHttpRequest = MockXMLHttpRequest;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates the multipart payload and reports upload progress", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ storage_key: "storage-key", uri: "lens://asset" }])),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "available" })));

    const sdk = createSDK({
      fetch,
      plugins: [groveUploadPlugin({ apiUrl: "https://api.example.com" })],
    });

    const onProgress = vi.fn();
    const result = await sdk.upload.uploadFile({
      file: new File(["hello"], "hello.txt", { type: "text/plain" }),
      account: "0x123",
      onProgress,
    });

    expect(result).toEqual({
      uri: "lens://asset",
      gatewayUrl: "https://api.example.com/storage-key",
      storageKey: "storage-key",
    });

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    expect(MockXMLHttpRequest.instances[0]?.method).toBe("POST");
    expect(MockXMLHttpRequest.instances[0]?.url).toBe("https://api.example.com/storage-key");
    expect(MockXMLHttpRequest.instances[0]?.sentEntries).toEqual([
      ["storage-key", "hello.txt"],
      ["lens-acl.json", "lens-acl.json"],
    ]);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    expect(onProgress).toHaveBeenCalledWith(45);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  test("polls propagation status until the upload is available", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ storage_key: "storage-key", uri: "lens://asset" }])),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "done" })));

    const sdk = createSDK({
      fetch,
      plugins: [groveUploadPlugin({ apiUrl: "https://api.example.com", pollIntervalMs: 1 })],
    });

    await sdk.upload.uploadFile({
      file: new File(["hello"], "hello.txt", { type: "text/plain" }),
      account: "0x123",
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/status/storage-key",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/status/storage-key",
      expect.any(Object),
    );
  });

  test("falls back to the safe poll interval for invalid propagation interval config", async () => {
    vi.useFakeTimers();

    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ storage_key: "storage-key", uri: "lens://asset" }])),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "done" })));

    const sdk = createSDK({
      fetch,
      plugins: [groveUploadPlugin({ apiUrl: "https://api.example.com", pollIntervalMs: 0 })],
    });

    const promise = sdk.upload.uploadFile({
      file: new File(["hello"], "hello.txt", { type: "text/plain" }),
      account: "0x123",
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(499);
    expect(fetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);

    await expect(promise).resolves.toEqual({
      uri: "lens://asset",
      gatewayUrl: "https://api.example.com/storage-key",
      storageKey: "storage-key",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("fails for non-browser environments without upload apis", async () => {
    (
      globalThis as typeof globalThis & { XMLHttpRequest?: typeof MockXMLHttpRequest }
    ).XMLHttpRequest = undefined;

    const sdk = createSDK({
      fetch: vi.fn<typeof globalThis.fetch>(),
      plugins: [groveUploadPlugin()],
    });

    await expect(
      sdk.upload.uploadFile({
        file: new File(["hello"], "hello.txt", { type: "text/plain" }),
        account: "0x123",
      }),
    ).rejects.toBeInstanceOf(GroveUploadEnvironmentError);
  });

  test("throws when propagation returns an error status", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ storage_key: "storage-key", uri: "lens://asset" }])),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "error_processing" })));

    const sdk = createSDK({
      fetch,
      plugins: [groveUploadPlugin({ apiUrl: "https://api.example.com" })],
    });

    await expect(
      sdk.upload.uploadFile({
        file: new File(["hello"], "hello.txt", { type: "text/plain" }),
        account: "0x123",
      }),
    ).rejects.toBeInstanceOf(GroveUploadPropagationError);
  });

  test("throws typed request errors for timed out allocation requests", async () => {
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
      plugins: [groveUploadPlugin({ apiUrl: "https://api.example.com" })],
    });

    const promise = sdk.upload.uploadFile({
      file: new File(["hello"], "hello.txt", { type: "text/plain" }),
      account: "0x123",
    });
    const rejection = expect(promise).rejects.toMatchObject<GroveUploadRequestError>({
      name: "GroveUploadRequestError",
      code: "GROVE_UPLOAD_TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(10);

    await rejection;

    vi.useRealTimers();
  });

  test("throws propagation errors for non-2xx propagation responses", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ storage_key: "storage-key", uri: "lens://asset" }])),
      )
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    const sdk = createSDK({
      fetch,
      plugins: [groveUploadPlugin({ apiUrl: "https://api.example.com" })],
    });

    await expect(
      sdk.upload.uploadFile({
        file: new File(["hello"], "hello.txt", { type: "text/plain" }),
        account: "0x123",
      }),
    ).rejects.toBeInstanceOf(GroveUploadPropagationError);
  });

  afterAll(() => {
    (
      globalThis as typeof globalThis & { XMLHttpRequest?: typeof MockXMLHttpRequest }
    ).XMLHttpRequest = originalXhr;
  });
});
