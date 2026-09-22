import { describe, expect, test } from "vitest";

import {
  createSiwoManifest,
  createSiwoManifestHandler,
  normalizeSiwoOrigin,
  ORB_SIWO_MANIFEST_PATH,
  resolveSiwoOrigin,
  SiwoManifestConfigError,
} from "../../src/auth/site";

const request = (host: string, method = "GET") =>
  new Request(`https://${host}${ORB_SIWO_MANIFEST_PATH}`, { method });

describe("Sign in with Orb site manifest", () => {
  test("serves exactly {version, origin} as application/json", async () => {
    const handler = createSiwoManifestHandler({ origin: "https://app.example.com" });
    const response = handler(request("app.example.com"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    const text = await response.text();
    expect(text).toBe('{"version":1,"origin":"https://app.example.com"}');
    expect(text.length).toBeLessThan(2048);
  });

  test("works without a request (Next.js route handlers may call GET())", async () => {
    const response = createSiwoManifestHandler({ origin: "https://app.example.com" })();
    await expect(response.json()).resolves.toEqual({
      version: 1,
      origin: "https://app.example.com",
    });
  });

  test("picks the origin for the request host from an allow-list", async () => {
    const handler = createSiwoManifestHandler({
      origins: ["https://app.example.com", "https://www.example.org"],
    });

    await expect(handler(request("www.example.org")).json()).resolves.toEqual({
      version: 1,
      origin: "https://www.example.org",
    });

    const unknown = handler(request("preview-123.vercel.app"));
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("cache-control")).toBe("no-store");
  });

  test("answers HEAD without a body and refuses other methods", async () => {
    const handler = createSiwoManifestHandler({ origin: "https://app.example.com" });

    const head = handler(request("app.example.com", "HEAD"));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(handler(request("app.example.com", "POST")).status).toBe(405);
  });

  test.each([
    "http://app.example.com",
    "https://app.example.com/",
    "https://app.example.com/path",
    "https://APP.example.com",
    "app.example.com",
  ])("rejects %s at creation time", (origin) => {
    expect(() => createSiwoManifestHandler({ origin })).toThrow(SiwoManifestConfigError);
    expect(() => createSiwoManifest(origin)).toThrow(SiwoManifestConfigError);
  });

  test("accepts an explicit port and matches hosts with ports", () => {
    expect(normalizeSiwoOrigin("https://app.example.com:8443")).toBe(
      "https://app.example.com:8443",
    );
    expect(resolveSiwoOrigin(["https://app.example.com:8443"], "app.example.com:8443")).toBe(
      "https://app.example.com:8443",
    );
    expect(resolveSiwoOrigin(["https://app.example.com:8443"], "app.example.com")).toBeNull();
  });

  test("requires at least one origin", () => {
    expect(() => createSiwoManifestHandler({ origins: [] })).toThrow(SiwoManifestConfigError);
  });
});
