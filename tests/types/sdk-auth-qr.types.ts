import { authPlugin } from "../../src/auth/index";
import { type QrConnectResult, qrAuthPlugin } from "../../src/auth/qr/index";
import { createSDK } from "../../src/index";

const sdk = createSDK({
  plugins: [
    authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
    qrAuthPlugin({ initUrl: "/qr/init", pollUrl: "/qr/poll" }),
  ],
});

const qrResult = sdk.auth.connectWithQr();
const typedQrResult: Promise<QrConnectResult> = qrResult;

typedQrResult.then((result) => {
  const accessToken: string = result.accessToken;
  const idToken: string | undefined = result.idToken;
  const refreshToken: string | undefined = result.refreshToken;
  const authenticationId: string | undefined = result.authenticationId;

  void accessToken;
  void idToken;
  void refreshToken;
  void authenticationId;
});
