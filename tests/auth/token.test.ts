import { describe, expect, test, vi } from "vitest";

import { decodeToken, isTokenExpired, tokenExpiresWithin } from "../../src/auth/index";

function createToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `header.${encoded}.signature`;
}

describe("token utilities", () => {
  test("decodeToken returns the parsed payload for a valid token", () => {
    const token = createToken({ sub: "user-123", exp: 2_000_000_000, role: "admin" });

    expect(decodeToken(token)).toEqual({
      sub: "user-123",
      exp: 2_000_000_000,
      role: "admin",
    });
  });

  test("decodeToken returns null for an invalid token", () => {
    expect(decodeToken("not-a-token")).toBeNull();
  });

  test("decodeToken decodes UTF-8 payloads correctly on the atob path", () => {
    const originalAtob = globalThis.atob;
    const token = createToken({ name: "Jäätelö", city: "Helsinki" });

    vi.stubGlobal("atob", (value: string) => Buffer.from(value, "base64").toString("latin1"));

    try {
      expect(decodeToken(token)).toEqual({
        name: "Jäätelö",
        city: "Helsinki",
      });
    } finally {
      if (originalAtob) {
        vi.stubGlobal("atob", originalAtob);
      } else {
        vi.unstubAllGlobals();
      }
    }
  });

  test("tokenExpiresWithin returns true when the token expires inside the window", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

      const token = createToken({ exp: Math.floor(Date.now() / 1000) + 45 });

      expect(tokenExpiresWithin(token, 60)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("tokenExpiresWithin returns false when the token expires outside the window", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

      const token = createToken({ exp: Math.floor(Date.now() / 1000) + 120 });

      expect(tokenExpiresWithin(token, 60)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("isTokenExpired delegates to token expiry logic with a configurable buffer", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

      const token = createToken({ exp: Math.floor(Date.now() / 1000) + 20 });

      expect(isTokenExpired(token)).toBe(true);
      expect(isTokenExpired(token, 10)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
