import type {
  GroveUploadContext,
  GroveUploadPluginConfig,
  UploadFileInput,
  UploadFileResult,
} from "./types";
import {
  GroveUploadEnvironmentError,
  GroveUploadPropagationError,
  GroveUploadRequestError,
} from "./types";

const DEFAULT_API_URL = "https://api.grove.storage";
const DEFAULT_CHAIN_ID = 232;
const DEFAULT_ACL_TEMPLATE = "lens_account";
const DEFAULT_ACL_FILENAME = "lens-acl.json";
const DEFAULT_PROPAGATION_TIMEOUT_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

type StorageAllocation = {
  storage_key?: string;
  uri?: string;
};

type XMLHttpRequestLike = {
  status: number;
  responseText: string;
  upload: {
    addEventListener: (
      type: "progress",
      listener: (event: { lengthComputable: boolean; loaded: number; total: number }) => void,
    ) => void;
  };
  open: (method: string, url: string) => void;
  send: (body: FormData) => void;
  abort: () => void;
  addEventListener: (type: "load" | "error", listener: () => void) => void;
};

function normalizeApiUrl(apiUrl?: string): string {
  const resolved = apiUrl ?? DEFAULT_API_URL;
  return resolved.replace(/\/+$/, "");
}

function hasBrowserUploadApis(): boolean {
  return (
    typeof globalThis.File === "function" &&
    typeof globalThis.FormData === "function" &&
    typeof (globalThis as typeof globalThis & { XMLHttpRequest?: unknown }).XMLHttpRequest ===
      "function"
  );
}

function assertBrowserUploadApis(): void {
  if (!hasBrowserUploadApis()) {
    throw new GroveUploadEnvironmentError();
  }
}

function resolveTimeoutMs(config: GroveUploadPluginConfig, context: GroveUploadContext): number {
  return (
    config.propagationTimeoutMs ?? context.defaults?.timeoutMs ?? DEFAULT_PROPAGATION_TIMEOUT_MS
  );
}

function resolvePollIntervalMs(config: GroveUploadPluginConfig): number {
  return config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
}

function toRequestError(reason: unknown, message: string): GroveUploadRequestError {
  if (reason instanceof GroveUploadRequestError) {
    return reason;
  }

  if (reason instanceof DOMException && reason.name === "TimeoutError") {
    return new GroveUploadRequestError(message, {
      code: "GROVE_UPLOAD_TIMEOUT",
      cause: reason,
    });
  }

  return new GroveUploadRequestError(message, {
    code: "GROVE_UPLOAD_ABORTED",
    cause: reason,
  });
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal?.aborted) {
      throw toRequestError(signal.reason, "Upload was aborted.");
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(toRequestError(signal?.reason, "Upload was aborted."));
    };

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function allocateStorage(
  context: GroveUploadContext,
  apiUrl: string,
  signal?: AbortSignal,
): Promise<{ storageKey: string; uri: string }> {
  const response = await context
    .fetch(`${apiUrl}/link/new?amount=1`, {
      method: "POST",
      signal,
    })
    .catch((error) => {
      throw signal?.aborted
        ? toRequestError(signal.reason, "Failed to allocate storage.")
        : new GroveUploadRequestError("Failed to allocate storage.", {
            cause: error,
          });
    });

  if (!response.ok) {
    throw new GroveUploadRequestError("Failed to allocate storage.", {
      status: response.status,
    });
  }

  const payload = (await response.json()) as StorageAllocation[] | undefined;
  const allocation = Array.isArray(payload) ? payload[0] : undefined;

  if (
    !allocation ||
    typeof allocation.storage_key !== "string" ||
    typeof allocation.uri !== "string"
  ) {
    throw new GroveUploadRequestError("Storage allocation response was invalid.", {
      code: "GROVE_UPLOAD_INVALID_ALLOCATION",
    });
  }

  return {
    storageKey: allocation.storage_key,
    uri: allocation.uri,
  };
}

function buildAclFile(account: string, config: GroveUploadPluginConfig): File {
  const aclTemplate = config.aclTemplate ?? DEFAULT_ACL_TEMPLATE;
  const acl = {
    template: aclTemplate,
    [aclTemplate]: account,
    chain_id: config.chainId ?? DEFAULT_CHAIN_ID,
  };

  return new File([JSON.stringify(acl)], DEFAULT_ACL_FILENAME, {
    type: "application/json",
  });
}

async function uploadMultipart(
  apiUrl: string,
  storageKey: string,
  file: File,
  aclFile: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const XMLHttpRequestCtor = (
    globalThis as typeof globalThis & {
      XMLHttpRequest?: new () => XMLHttpRequestLike;
    }
  ).XMLHttpRequest;

  if (!XMLHttpRequestCtor) {
    throw new GroveUploadEnvironmentError();
  }

  const form = new FormData();
  form.append(storageKey, file, file.name);
  form.append(aclFile.name, aclFile, aclFile.name);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequestCtor();
    const onAbort = () => {
      xhr.abort();
      cleanup();
      reject(toRequestError(signal?.reason, "Upload was aborted."));
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 90));
      }
    });
    xhr.addEventListener("load", () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(
        new GroveUploadRequestError(`Upload failed (${xhr.status}): ${xhr.responseText}`, {
          status: xhr.status,
        }),
      );
    });
    xhr.addEventListener("error", () => {
      cleanup();
      reject(new GroveUploadRequestError("Network error during upload."));
    });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.open("POST", `${apiUrl}/${storageKey}`);
    xhr.send(form);
  });
}

async function waitForPropagation(
  context: GroveUploadContext,
  apiUrl: string,
  storageKey: string,
  config: GroveUploadPluginConfig,
  signal?: AbortSignal,
): Promise<void> {
  const startedAt = Date.now();
  const timeoutMs = resolveTimeoutMs(config, context);
  const pollIntervalMs = resolvePollIntervalMs(config);

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      throw toRequestError(signal.reason, "Upload was aborted.");
    }

    const response = await context
      .fetch(`${apiUrl}/status/${storageKey}`, {
        signal,
      })
      .catch((error) => {
        throw signal?.aborted
          ? toRequestError(signal.reason, "Upload propagation check was aborted.")
          : new GroveUploadPropagationError("Failed to check storage propagation.", {
              cause: error,
            });
      });

    if (!response.ok) {
      throw new GroveUploadPropagationError(
        `Storage propagation check failed (${response.status}).`,
      );
    }

    const payload = (await response.json()) as { status?: string } | undefined;
    const status = payload?.status;

    if (status === "done" || status === "available") {
      return;
    }

    if (typeof status === "string" && (status.startsWith("error") || status === "unauthorized")) {
      throw new GroveUploadPropagationError(`Storage propagation failed with status "${status}".`);
    }

    await delay(pollIntervalMs, signal);
  }

  throw new GroveUploadPropagationError("Storage propagation timed out.");
}

export async function uploadFile(
  context: GroveUploadContext,
  config: GroveUploadPluginConfig,
  input: UploadFileInput,
): Promise<UploadFileResult> {
  assertBrowserUploadApis();
  const operationTimeout = context.createTimeoutSignal(
    resolveTimeoutMs(config, context),
    input.signal,
  );

  input.onProgress?.(0);

  const apiUrl = normalizeApiUrl(config.apiUrl);
  try {
    const { storageKey, uri } = await allocateStorage(context, apiUrl, operationTimeout.signal);
    const aclFile = buildAclFile(input.account, config);

    await uploadMultipart(
      apiUrl,
      storageKey,
      input.file,
      aclFile,
      input.onProgress,
      operationTimeout.signal,
    );
    await waitForPropagation(context, apiUrl, storageKey, config, operationTimeout.signal);

    input.onProgress?.(100);

    return {
      uri,
      gatewayUrl: `${apiUrl}/${storageKey}`,
      storageKey,
    };
  } finally {
    operationTimeout.cancel();
  }
}
