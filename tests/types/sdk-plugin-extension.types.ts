import { createSDK, type SDKPlugin } from "../../src/index";

const authPlugin = {
  name: "auth",
  namespace: "auth",
  setup: () => ({
    refresh: async () => "token",
  }),
} satisfies SDKPlugin<
  "auth",
  {
    refresh: () => Promise<string>;
  }
>;

const qrAuthPlugin = {
  name: "auth-qr",
  namespace: "auth",
  extends: "auth",
  requires: ["auth"],
  setup: () => ({
    connectWithQr: async () => "connected",
  }),
} satisfies SDKPlugin<
  "auth",
  {
    connectWithQr: () => Promise<string>;
  }
>;

const sdk = createSDK({
  plugins: [authPlugin, qrAuthPlugin],
});

const refresh: () => Promise<string> = sdk.auth.refresh;
const connectWithQr: () => Promise<string> = sdk.auth.connectWithQr;

void refresh;
void connectWithQr;
