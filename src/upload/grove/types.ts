import type { SDKContext, SDKPlugin } from "../../core/types";

export type GroveUploadPluginConfig = {
  apiUrl?: string;
  chainId?: number;
  aclTemplate?: string;
  propagationTimeoutMs?: number;
  pollIntervalMs?: number;
};

export type UploadFileInput = {
  file: File;
  account: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

export type UploadFileResult = {
  uri: string;
  gatewayUrl: string;
  storageKey: string;
};

export class GroveUploadError extends Error {
  code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GroveUploadError";
    this.code = code;
  }
}

export class GroveUploadEnvironmentError extends GroveUploadError {
  constructor(message = "Grove uploads require browser file upload APIs.") {
    super(message, "GROVE_UPLOAD_ENVIRONMENT");
    this.name = "GroveUploadEnvironmentError";
  }
}

export class GroveUploadRequestError extends GroveUploadError {
  status?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
      status?: number;
    },
  ) {
    super(message, options?.code ?? "GROVE_UPLOAD_REQUEST", { cause: options?.cause });
    this.name = "GroveUploadRequestError";
    this.status = options?.status;
  }
}

export class GroveUploadPropagationError extends GroveUploadError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "GROVE_UPLOAD_PROPAGATION", options);
    this.name = "GroveUploadPropagationError";
  }
}

export type GroveUploadCapabilities = {
  uploadFile: (input: UploadFileInput) => Promise<UploadFileResult>;
};

export type GroveUploadPlugin = SDKPlugin<"upload", GroveUploadCapabilities>;

export type GroveUploadContext = SDKContext;
