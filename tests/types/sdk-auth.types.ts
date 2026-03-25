import { authPlugin } from "../../src/auth/index";
import { createSDK } from "../../src/index";

const sdk = createSDK({
  plugins: [authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" })],
});

sdk.auth.refresh;
sdk.auth.revoke;
sdk.auth.decodeToken;

void sdk.auth.refresh({ refreshToken: "refresh-token" });
void sdk.auth.revoke({ authenticationId: "auth-id", accessToken: "access-token" });

// @ts-expect-error refresh requires a refreshToken
void sdk.auth.refresh({});

// @ts-expect-error revoke requires an authenticationId
void sdk.auth.revoke({ accessToken: "access-token" });

// @ts-expect-error revoke requires an accessToken
void sdk.auth.revoke({ authenticationId: "auth-id" });
