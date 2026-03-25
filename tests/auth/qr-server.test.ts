import { describe, expect, test } from "vitest";

import {
  createQrInitRequest,
  createQrPollRequest,
  parseQrInitResponse,
  parseQrPollResponse,
} from "../../src/auth/qr/server";

describe("QR server helpers", () => {
  test("builds an init request with credentials and origin headers", () => {
    const request = createQrInitRequest({
      endpoint: "https://qr.example.com/init-sign-in",
      credentials: "id_access",
      origin: "https://app.example.com",
    });

    expect(request.url).toBe("https://qr.example.com/init-sign-in?credentials=id_access");
    expect(request.init).toMatchObject({
      method: "GET",
      headers: {
        origin: "https://app.example.com",
        referer: "https://app.example.com",
      },
    });
  });

  test("builds a poll request with a JSON body and derives origin from referer", () => {
    const request = createQrPollRequest({
      endpoint: "https://qr.example.com/poll-sign-in",
      secret: "secret-123",
      referer: "https://app.example.com/login?from=qr",
    });

    expect(request.url).toBe("https://qr.example.com/poll-sign-in");
    expect(request.init).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example.com",
        referer: "https://app.example.com/login?from=qr",
      },
      body: JSON.stringify({ secret: "secret-123" }),
    });
  });

  test("parses init responses from nested payloads", () => {
    const parsed = parseQrInitResponse({
      data: {
        data: {
          qrCode: "data:image/png;base64,abc",
          secret: "qr-secret",
          deepLink: "app://sign-in",
        },
      },
    });

    expect(parsed.qrCode).toBe("data:image/png;base64,abc");
    expect(parsed.secret).toBe("qr-secret");
    expect(parsed.deepLink).toBe("app://sign-in");
  });

  test("parses poll responses from mixed status and nested data shapes", () => {
    const parsed = parseQrPollResponse({
      data: {
        status: "SUCCESS",
        data: {
          processed: true,
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
      },
    });

    expect(parsed.status).toBe("SUCCESS");
    expect(parsed.processed).toBe(true);
    expect(parsed.accessToken).toBe("access-token");
    expect(parsed.idToken).toBeUndefined();
    expect(parsed.refreshToken).toBe("refresh-token");
  });
});
