import { describe, expect, test, vi } from "vitest";

import {
  type AuthRequestError,
  authPlugin,
  getSessionExpiry,
  isSessionStale,
  shouldRefreshSession,
} from "../../src/auth/index";

function createToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `header.${encoded}.signature`;
}

describe("session helpers", () => {
  test("getSessionExpiry returns the access token expiry", () => {
    const session = {
      accessToken: createToken({ exp: 2_000_000_000 }),
    };

    expect(getSessionExpiry(session)).toEqual(new Date(2_000_000_000 * 1000));
  });

  test("isSessionStale uses the most recent session timestamp", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

      expect(
        isSessionStale(
          {
            updatedAtMs: new Date("2026-03-25T11:58:00.000Z"),
          },
          60_000,
        ),
      ).toBe(true);

      expect(
        isSessionStale(
          {
            createdAtMs: Date.parse("2026-03-25T11:59:30.000Z"),
          },
          60_000,
        ),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("shouldRefreshSession returns true when a refreshable token is inside the window", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

      expect(
        shouldRefreshSession(
          {
            accessToken: createToken({ exp: Math.floor(Date.now() / 1000) + 20 }),
            refreshToken: "refresh-token",
          },
          30,
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("authPlugin", () => {
  test("refresh posts the refresh token and returns the next session", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: "next-access-token",
        refreshToken: "next-refresh-token",
        authenticationId: "auth-2",
      }),
    });

    const sdk = {
      auth: authPlugin({
        refreshUrl: "/refresh",
        revokeUrl: "/revoke",
      }).setup({
        fetch,
        logger: {},
        runtime: "browser",
        defaults: undefined,
        createTimeoutSignal: () => ({
          cancel: () => undefined,
          signal: undefined,
          timeoutMs: undefined,
        }),
        mergeAbortSignals: () => undefined,
      }),
    };

    await expect(
      sdk.auth.refresh({
        refreshToken: "current-refresh-token",
        authenticationId: "auth-1",
      }),
    ).resolves.toEqual({
      accessToken: "next-access-token",
      refreshToken: "next-refresh-token",
      authenticationId: "auth-2",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/refresh",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          refreshToken: "current-refresh-token",
          authenticationId: "auth-1",
        }),
      }),
    );
  });

  test("revoke posts the session identifiers", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        revoked: true,
      }),
    });

    const sdk = {
      auth: authPlugin({
        refreshUrl: "/refresh",
        revokeUrl: "/revoke",
      }).setup({
        fetch,
        logger: {},
        runtime: "browser",
        defaults: undefined,
        createTimeoutSignal: () => ({
          cancel: () => undefined,
          signal: undefined,
          timeoutMs: undefined,
        }),
        mergeAbortSignals: () => undefined,
      }),
    };

    await expect(
      sdk.auth.revoke({
        authenticationId: "auth-1",
        accessToken: "access-token",
      }),
    ).resolves.toEqual({
      revoked: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      "/revoke",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authenticationId: "auth-1",
          accessToken: "access-token",
        }),
      }),
    );
  });

  test("refresh throws a typed error when the response is not successful", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        message: "refresh failed",
      }),
    });

    const auth = authPlugin({
      refreshUrl: "/refresh",
      revokeUrl: "/revoke",
    }).setup({
      fetch,
      logger: {},
      runtime: "browser",
      defaults: undefined,
      createTimeoutSignal: () => ({
        cancel: () => undefined,
        signal: undefined,
        timeoutMs: undefined,
      }),
      mergeAbortSignals: () => undefined,
    });

    await expect(
      auth.refresh({
        refreshToken: "bad-refresh-token",
      }),
    ).rejects.toMatchObject<AuthRequestError>({
      name: "AuthRequestError",
      status: 401,
      operation: "refresh",
      message: "refresh failed",
    });
  });
});
