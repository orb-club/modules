import { describe, expect, test, vi } from "vitest";

import { createOrbLogin } from "../../src/auth";

describe("createOrbLogin", () => {
  test("connects with browser-direct Orb QR defaults", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            qrCode: "qr-code",
            secret: "secret-123",
            deepLink: "orbapp://orb/sign-in",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "SUCCESS",
          data: {
            processed: true,
            accessToken: "access-token",
            refreshToken: "refresh-token",
          },
        }),
      );

    const orb = createOrbLogin({ fetch });
    const onInit = vi.fn();

    await expect(orb.connectWithQr({ onInit })).resolves.toEqual(
      expect.objectContaining({
        processed: true,
        accessToken: "access-token",
        refreshToken: "refresh-token",
      }),
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://orbapi.xyz/init-sign-in?credentials=id_access_refresh",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://orbapi.xyz/poll-sign-in",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ secret: "secret-123" }),
      }),
    );
    expect(onInit).toHaveBeenCalledWith({
      qrCode: "qr-code",
      deepLink: "orbapp://orb/sign-in",
    });
  });

  test("refreshes directly through Lens GraphQL by default", async () => {
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
          refreshToken: "refresh-token",
        },
      });

      return Response.json({
        data: {
          refresh: {
            __typename: "AuthenticationTokens",
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          },
        },
      });
    });

    const orb = createOrbLogin({ fetch });

    await expect(orb.refresh({ refreshToken: "refresh-token" })).resolves.toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });
  });

  test("revokes directly through Lens GraphQL by default", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: { request: { authenticationId: string } };
      };
      const headers = new Headers(init?.headers);

      expect(_input).toBe("https://api.lens.xyz/graphql");
      expect(init?.method).toBe("POST");
      expect(headers.get("x-access-token")).toBe("Bearer access-token");
      expect(body.query).toContain("mutation RevokeAuthentication");
      expect(body.variables).toEqual({
        request: {
          authenticationId: "auth-123",
        },
      });

      return Response.json({
        data: {
          revokeAuthentication: null,
        },
      });
    });

    const orb = createOrbLogin({ fetch });

    await expect(
      orb.revoke({ authenticationId: "auth-123", accessToken: "access-token" }),
    ).resolves.toEqual({
      revoked: true,
    });
  });
});
