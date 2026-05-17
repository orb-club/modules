import { describe, expect, test, vi } from "vitest";

import { authPlugin } from "../../src/auth";
import { LensAuthForbiddenError, lensAuthPlugin } from "../../src/auth/lens";
import { createSDK } from "../../src/index";

function createToken(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("lensAuthPlugin", () => {
  test("refreshes directly against the configured Lens GraphQL endpoint", async () => {
    const accessToken = createToken({
      exp: 2_000_000_000,
      act: { sub: "0xrefresh" },
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: { request: { refreshToken: string } };
      };

      expect(_input).toBe("https://api.lens.xyz/graphql");
      expect(init?.method).toBe("POST");
      expect(body.query).toContain("mutation Refresh");
      expect(body.variables).toEqual({
        request: {
          refreshToken: "refresh-123",
        },
      });

      return new Response(
        JSON.stringify({
          data: {
            refresh: {
              __typename: "AuthenticationTokens",
              accessToken,
              refreshToken: "refresh-456",
              idToken: "id-456",
            },
          },
        }),
        {
          headers: {
            "content-type": "application/graphql-response+json; charset=utf-8",
          },
        },
      );
    });

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        lensAuthPlugin({ graphqlUrl: "https://api.lens.xyz/graphql" }),
      ],
    });

    await expect(sdk.auth.refreshLensSession({ refreshToken: "refresh-123" })).resolves.toEqual({
      accessToken,
      refreshToken: "refresh-456",
      idToken: "id-456",
    });
  });

  test("syncs a refreshable session and preserves missing token fields", async () => {
    const accessToken = createToken({
      exp: Math.floor(Date.now() / 1000) + 120,
      act: { sub: "0xdef456" },
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        data: {
          refresh: {
            __typename: "AuthenticationTokens",
            accessToken,
          },
        },
      }),
    );

    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        lensAuthPlugin({ graphqlUrl: "https://api.lens.xyz/graphql" }),
      ],
    });

    await expect(
      sdk.auth.syncLensSession({
        refreshToken: "refresh-123",
        idToken: "old-id-token",
      }),
    ).resolves.toEqual({
      accessToken,
      refreshToken: "refresh-123",
      idToken: "old-id-token",
      account: "0xdef456",
    });
  });

  test("does not refresh a session outside the refresh window", async () => {
    const accessToken = createToken({
      exp: Math.floor(Date.now() / 1000) + 120,
      act: { sub: "0xfresh" },
    });
    const fetch = vi.fn<typeof globalThis.fetch>();
    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        lensAuthPlugin({ graphqlUrl: "https://api.lens.xyz/graphql" }),
      ],
    });

    await expect(
      sdk.auth.syncLensSession({ accessToken, refreshToken: "refresh-123" }),
    ).resolves.toEqual({
      accessToken,
      refreshToken: "refresh-123",
      account: "0xfresh",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("returns null for forbidden refresh responses", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        data: {
          refresh: {
            __typename: "ForbiddenError",
            reason: "Expired",
          },
        },
      }),
    );
    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        lensAuthPlugin({ graphqlUrl: "https://api.lens.xyz/graphql" }),
      ],
    });

    await expect(sdk.auth.refreshLensSession({ refreshToken: "refresh-123" })).rejects.toThrow(
      LensAuthForbiddenError,
    );
    await expect(sdk.auth.syncLensSession({ refreshToken: "refresh-123" })).resolves.toBeNull();
  });

  test("keeps the hydrated session on transient refresh failures", async () => {
    const expiredToken = createToken({
      exp: Math.floor(Date.now() / 1000) - 60,
      sub: "0xstale",
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        errors: [{ message: "upstream unavailable" }],
      }),
    );
    const sdk = createSDK({
      fetch,
      plugins: [
        authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
        lensAuthPlugin({ graphqlUrl: "https://api.lens.xyz/graphql" }),
      ],
    });

    await expect(
      sdk.auth.syncLensSession({ accessToken: expiredToken, refreshToken: "refresh-123" }),
    ).resolves.toEqual({
      accessToken: expiredToken,
      refreshToken: "refresh-123",
      account: "0xstale",
    });
  });
});
