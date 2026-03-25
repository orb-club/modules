import { createSDK } from "../../src/index";
import { backendTransportPlugin } from "../../src/transport/backend/index";

const sdk = createSDK({
  plugins: [backendTransportPlugin({ baseUrl: "https://api.example.com" })],
});

sdk.transport.call;

void sdk.transport.call("/posts", { content: "gm" });
void sdk.transport.call<{ ok: true }>("/posts", { content: "gm" });
