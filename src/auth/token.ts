import type { TokenPayload } from "./types";

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof globalThis.atob === "function") {
    const decoded = globalThis.atob(padded);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    return JSON.parse(decodeBase64Url(parts[1])) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiry(token: string): Date | null {
  const payload = decodeToken(token);

  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return new Date(payload.exp * 1000);
}

export function tokenExpiresWithin(token: string, seconds: number): boolean {
  const expiry = getTokenExpiry(token);

  if (!expiry) {
    return true;
  }

  return Date.now() >= expiry.getTime() - seconds * 1000;
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  return tokenExpiresWithin(token, bufferSeconds);
}
