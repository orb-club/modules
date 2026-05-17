import { authPlugin } from "../../src/auth/index";
import { type LensRefreshSessionResult, lensAuthPlugin } from "../../src/auth/lens/index";
import { createSDK } from "../../src/index";

const sdk = createSDK({
  plugins: [
    authPlugin({ refreshUrl: "/refresh", revokeUrl: "/revoke" }),
    lensAuthPlugin({ graphqlUrl: "https://api.lens.xyz/graphql" }),
  ],
});

const account: string | null = sdk.auth.getLensAccountFromAccessToken("token");
const refreshResult: Promise<LensRefreshSessionResult> = sdk.auth.refreshLensSession({
  refreshToken: "refresh-token",
});

sdk.auth.syncLensSession({
  accessToken: "access-token",
  refreshToken: "refresh-token",
});

void account;
void refreshResult;
