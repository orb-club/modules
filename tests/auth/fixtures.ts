// Protocol-shaped payloads for isolated tests of the browser-site sign-in client.
export const SESSION = "a".repeat(64);
export const DEEP_LINK = `orbapp://orb/approve?secret=${"b".repeat(64)}`;
export const ADDRESS = "0x1234567890abcdef1234567890ABCDEF12345678";

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function jwt(payload: Record<string, unknown>): string {
  return `${encodeSegment({ alg: "none" })}.${encodeSegment(payload)}.sig`;
}

export function ready(expiresAt = Date.now() + 300_000) {
  return Response.json({
    status: "SUCCESS",
    data: {
      phase: "READY",
      session: SESSION,
      qrCode: "data:image/png;base64,AAAA",
      deepLink: DEEP_LINK,
      expiresAt,
    },
  });
}

export function provisioning() {
  return Response.json({
    status: "SUCCESS",
    data: { phase: "PROVISIONING", retryAfterMs: 10_000 },
  });
}

export function pending() {
  return Response.json({ status: "SUCCESS", data: { processed: false } });
}

export function approved(overrides: Record<string, unknown> = {}) {
  return Response.json({
    status: "SUCCESS",
    data: {
      processed: true,
      source: "lens",
      user_id: ADDRESS,
      idToken: jwt({ sub: ADDRESS }),
      accessToken: jwt({ sub: ADDRESS, exp: 4_102_444_800 }),
      ...overrides,
    },
  });
}

export function failed(msg = "Site sign-in is unavailable for this origin") {
  return Response.json({ status: "FAILED", msg });
}
