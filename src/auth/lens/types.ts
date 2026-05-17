import type { SDKPlugin } from "../../core/types";
import type { AuthRequestOptions, AuthSession } from "../types";

export type LensAuthPluginConfig = {
  graphqlUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type LensRefreshSessionInput = {
  refreshToken: string;
};

export type LensRefreshSessionResult = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
} & Record<string, unknown>;

export type LensSession = AuthSession & {
  account?: string;
};

export type LensSyncSessionOptions = AuthRequestOptions & {
  refreshWindowSeconds?: number;
};

export class LensAuthForbiddenError extends Error {
  reason?: string;

  constructor(reason?: string) {
    super(reason ? `Lens refresh forbidden: ${reason}` : "Lens refresh forbidden.");
    this.name = "LensAuthForbiddenError";
    this.reason = reason;
  }
}

export type LensAuthCapabilities = {
  getLensAccountFromAccessToken: (token?: string) => string | null;
  refreshLensSession: (
    input: LensRefreshSessionInput,
    options?: AuthRequestOptions,
  ) => Promise<LensRefreshSessionResult>;
  syncLensSession: (
    session: LensSession | null,
    options?: LensSyncSessionOptions,
  ) => Promise<LensSession | null>;
};

export type LensAuthPlugin = SDKPlugin<"auth", LensAuthCapabilities>;
