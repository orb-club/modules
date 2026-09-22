import { authPlugin } from "../../src/auth/index";
import {
  QrAuthError,
  type QrConnectResult,
  type QrFailureReason,
  qrAuthPlugin,
} from "../../src/auth/qr/index";
import { createSDK } from "../../src/index";

const sdk = createSDK({
  plugins: [
    authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
    qrAuthPlugin({ baseUrl: "https://orbapi.xyz", pollIntervalMs: 2_500 }),
  ],
});

const qrResult = sdk.auth.connectWithQr({
  signal: new AbortController().signal,
  onInit({ qrCode, deepLink, expiresAt }) {
    const values: [string, string, number] = [qrCode, deepLink, expiresAt];
    void values;
  },
  onProvisioning() {},
});
const typedQrResult: Promise<QrConnectResult> = qrResult;

typedQrResult.then((result) => {
  const accessToken: string = result.accessToken;
  const idToken: string = result.idToken;
  const account: string = result.user_id;
  const expiresAt: number | null = result.expiresAt;

  void accessToken;
  void idToken;
  void account;
  void expiresAt;

  // @ts-expect-error the protocol never issues a refresh token
  void result.refreshToken;
});

typedQrResult.catch((error: unknown) => {
  if (error instanceof QrAuthError) {
    const reason: QrFailureReason = error.reason;
    void reason;
  }
});

// @ts-expect-error the legacy init endpoint is gone
qrAuthPlugin({ initUrl: "/qr/init" });

// @ts-expect-error the legacy poll endpoint is gone
qrAuthPlugin({ pollUrl: "/qr/poll" });

// @ts-expect-error credentials are fixed by the protocol
void sdk.auth.connectWithQr({ credentials: "id_access_refresh" });
