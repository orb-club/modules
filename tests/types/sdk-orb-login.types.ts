import { createOrbLogin, type OrbLogin } from "../../src/auth/index";

const orb: OrbLogin = createOrbLogin();

void orb.connectWithQr();
void orb.refresh({ refreshToken: "refresh-token" });
void orb.revoke({ authenticationId: "auth-id", accessToken: "access-token" });
void orb.syncSession({ accessToken: "access-token", refreshToken: "refresh-token" });
void orb.connectWithQr({
  onInit(payload) {
    const qrCode: string = payload.qrCode;
    const deepLink: string | undefined = payload.deepLink;

    void qrCode;
    void deepLink;

    // @ts-expect-error createOrbLogin does not expose the QR polling secret to UI callbacks
    void payload.secret;
  },
});

const account: string | null = orb.getAccountFromAccessToken("token");

void account;

createOrbLogin({
  qr: {
    credentials: "id_access",
  },
  lens: {
    graphqlUrl: "https://api.lens.xyz/graphql",
  },
});

// @ts-expect-error refresh requires a refreshToken
void orb.refresh({});

// @ts-expect-error revoke requires an authenticationId
void orb.revoke({ accessToken: "access-token" });
