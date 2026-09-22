import {
  createSiwoManifest,
  createSiwoManifestHandler,
  ORB_SIWO_MANIFEST_PATH,
  type SiwoManifest,
} from "../../src/auth/site/index";

const manifest: SiwoManifest = createSiwoManifest("https://app.example.com");
const version: 1 = manifest.version;
const path: string = ORB_SIWO_MANIFEST_PATH;

// Next.js App Router route handler shape.
export const GET: (request: Request) => Response = createSiwoManifestHandler({
  origin: "https://app.example.com",
});

// Hono-style usage: pass the raw Request.
const handler = createSiwoManifestHandler({ origins: ["https://a.example", "https://b.example"] });
const response: Response = handler(new Request(`https://a.example${path}`));

void version;
void response;

// @ts-expect-error an origin or an origin allow-list is required
createSiwoManifestHandler({});
