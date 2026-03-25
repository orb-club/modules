import type { AuthContext, AuthPluginConfig, AuthRequestOptions } from "./types";
import { AuthRequestError } from "./types";

type RequestOperation = "refresh" | "revoke";

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export async function postJson<TResponse>(
  context: AuthContext,
  config: AuthPluginConfig,
  operation: RequestOperation,
  url: string,
  body: Record<string, unknown>,
  options?: AuthRequestOptions,
): Promise<TResponse> {
  const timeoutHandle = context.createTimeoutSignal(
    options?.timeoutMs ?? config.timeoutMs,
    options?.signal,
  );

  try {
    const response = await context.fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(body),
      signal: timeoutHandle.signal,
    });

    const payload = (await response.json().catch(() => undefined)) as unknown;

    if (!response.ok) {
      throw new AuthRequestError(
        getErrorMessage(payload, `${operation} request failed`),
        operation,
        {
          status: response.status,
        },
      );
    }

    return (payload ?? {}) as TResponse;
  } catch (error) {
    if (error instanceof AuthRequestError) {
      throw error;
    }

    throw new AuthRequestError(`${operation} request failed`, operation, {
      cause: error,
    });
  } finally {
    timeoutHandle.cancel();
  }
}
