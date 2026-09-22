import { describe, expect, test, vi } from "vitest";

import { createOrbLogin } from "../../src/auth";
import { ADDRESS, approved, jwt, ready } from "./fixtures";

describe("createOrbLogin", () => {
  test("connects with browser-site Sign in with Orb and hands onInit only display fields", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(ready())
      .mockResolvedValueOnce(approved());

    const orb = createOrbLogin({ fetch });
    const onInit = vi.fn();

    await expect(orb.connectWithQr({ onInit })).resolves.toMatchObject({
      processed: true,
      source: "lens",
      user_id: ADDRESS,
      expiresAt: 4_102_444_800_000,
    });

    expect(fetch.mock.calls[0]?.[0]).toBe("https://orbapi.xyz/init-site-sign-in");
    expect(fetch.mock.calls[1]?.[0]).toBe("https://orbapi.xyz/poll-site-sign-in");
    expect(Object.keys(onInit.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
      "deepLink",
      "expiresAt",
      "qrCode",
    ]);
  });

  test("refresh is gone: the protocol issues no refresh token", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const orb = createOrbLogin({ fetch });

    await expect(orb.refresh({ refreshToken: "refresh-token" })).rejects.toMatchObject({
      name: "AuthSessionError",
      code: "AUTH_REFRESH_UNSUPPORTED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("syncSession keeps a live session and drops an expired one without refreshing", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const orb = createOrbLogin({ fetch });
    const live = jwt({ sub: ADDRESS, exp: Math.floor(Date.now() / 1000) + 600 });
    const dead = jwt({ sub: ADDRESS, exp: Math.floor(Date.now() / 1000) - 1 });

    await expect(orb.syncSession({ accessToken: live })).resolves.toMatchObject({
      accessToken: live,
      account: ADDRESS,
    });
    await expect(orb.syncSession({ accessToken: dead })).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
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
