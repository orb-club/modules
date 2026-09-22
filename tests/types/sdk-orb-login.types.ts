import { createOrbLogin, type OrbLogin, watchSessionExpiry } from "../../src/auth/index";

const orb: OrbLogin = createOrbLogin();

void orb.connectWithQr();
void orb.revoke({ authenticationId: "auth-id", accessToken: "access-token" });
void orb.syncSession({ accessToken: "access-token" });
void orb.connectWithQr({
  onInit(payload) {
    const qrCode: string = payload.qrCode;
    const deepLink: string = payload.deepLink;
    const expiresAt: number = payload.expiresAt;

    void qrCode;
    void deepLink;
    void expiresAt;

    // @ts-expect-error createOrbLogin does not expose the polling session to UI callbacks
    void payload.session;
  },
});

void orb.connectWithQr().then((result) => {
  const stop: () => void = orb.watchSessionExpiry(result.expiresAt, () => undefined);
  const stopToo: () => void = watchSessionExpiry(result.expiresAt, () => undefined);
  void stop;
  void stopToo;
});

const touch: boolean = orb.prefersDeepLink();
const account: string | null = orb.getAccountFromAccessToken("token");

void touch;
void account;

createOrbLogin({
  qr: {
    baseUrl: "https://orbapi.xyz",
  },
  lens: {
    graphqlUrl: "https://api.lens.xyz/graphql",
  },
});

createOrbLogin({
  qr: {
    // @ts-expect-error legacy credentials are gone
    credentials: "id_access",
  },
});

// @ts-expect-error revoke requires an authenticationId
void orb.revoke({ accessToken: "access-token" });
