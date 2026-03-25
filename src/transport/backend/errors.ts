export class BackendTransportError extends Error {
  code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackendTransportError";
    this.code = code;
  }
}

export class BackendTransportConfigError extends BackendTransportError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "BACKEND_TRANSPORT_CONFIG", options);
    this.name = "BackendTransportConfigError";
  }
}

export class BackendTransportRequestError extends BackendTransportError {
  status?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
      status?: number;
    },
  ) {
    super(message, options?.code ?? "BACKEND_TRANSPORT_REQUEST", {
      cause: options?.cause,
    });
    this.name = "BackendTransportRequestError";
    this.status = options?.status;
  }
}
