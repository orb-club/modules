import { describe, expect, test } from "vitest";

import { createSDK } from "../../src/index";
import { mediaPlugin, parseUrl } from "../../src/media";

describe("media url resolution", () => {
  test("resolves ipfs arweave lens and ipfs path urls", () => {
    expect(parseUrl("ipfs://QmHash")).toBe("https://gw.ipfs-lens.dev/ipfs/QmHash");
    expect(parseUrl("ipfs://ipfs/QmHash")).toBe("https://gw.ipfs-lens.dev/ipfs/QmHash");
    expect(parseUrl("ar://tx123")).toBe("https://arweave.net/tx123");
    expect(parseUrl("lens://abc123")).toBe("https://api.grove.storage/abc123");
    expect(parseUrl("https://example.com/ipfs/QmHash")).toBe(
      "https://gw.ipfs-lens.dev/ipfs/QmHash",
    );
    expect(parseUrl("http://example.com/file.png")).toBe("http://example.com/file.png");
  });

  test("matches app media normalization for wrapped and embedded storage urls", () => {
    expect(
      parseUrl("https://img.example.com/thumbnailDimension768/https://example.com/image.png"),
    ).toBe("https://example.com/image.png");
    expect(parseUrl("https://proxy.example.com/media/ipfs://QmWrapped")).toBe(
      "https://gw.ipfs-lens.dev/ipfs/QmWrapped",
    );
    expect(parseUrl("https://proxy.example.com/media/ar://wrapped-tx")).toBe(
      "https://arweave.net/wrapped-tx",
    );
    expect(parseUrl("example.com/image.png")).toBe("example.com/image.png");
  });

  test("wraps image and audio urls with configured gateways", () => {
    const sdk = createSDK({
      plugins: [
        mediaPlugin({
          imageGateway: "https://img.example.com",
          audioGateway: "https://audio.example.com",
        }),
      ],
    });

    expect(sdk.media.parseImage("lens://abc123")).toBe(
      "https://img.example.com/thumbnailDimension768/https://api.grove.storage/abc123",
    );
    expect(sdk.media.parseAudio("lens://abc123")).toBe(
      "https://audio.example.com/https://api.grove.storage/abc123",
    );
    expect(sdk.media.parseVideo("lens://abc123")).toBe("https://api.grove.storage/abc123");
  });

  test("falls back to resolved urls when optional gateways are omitted", () => {
    const sdk = createSDK({
      plugins: [mediaPlugin()],
    });

    expect(sdk.media.parseImage("lens://abc123")).toBe("https://api.grove.storage/abc123");
    expect(sdk.media.parseAudio("lens://abc123")).toBe("https://api.grove.storage/abc123");
    expect(sdk.media.parseVideo("lens://abc123")).toBe("https://api.grove.storage/abc123");
    expect(sdk.media.parse("lens://abc123", { type: "image" })).toBe(
      "https://api.grove.storage/abc123",
    );
  });

  test("rewraps previously wrapped image and audio URLs without double-wrapping", () => {
    const sdk = createSDK({
      plugins: [
        mediaPlugin({
          imageGateway: "https://img.new.example.com",
          audioGateway: "https://audio.new.example.com",
        }),
      ],
    });

    expect(
      sdk.media.parseImage(
        "https://img.old.example.com/thumbnailDimension768/https://api.grove.storage/abc123",
      ),
    ).toBe("https://img.new.example.com/thumbnailDimension768/https://api.grove.storage/abc123");

    expect(
      sdk.media.parseAudio("https://audio.old.example.com/https://api.grove.storage/abc123"),
    ).toBe("https://audio.new.example.com/https://api.grove.storage/abc123");

    const pathPrefixedSdk = createSDK({
      plugins: [
        mediaPlugin({
          imageGateway: "https://img.new.example.com/media",
          audioGateway: "https://audio.new.example.com/media",
        }),
      ],
    });

    expect(
      pathPrefixedSdk.media.parseImage(
        "https://img.old.example.com/media/thumbnailDimension768/https://api.grove.storage/abc123",
      ),
    ).toBe(
      "https://img.new.example.com/media/thumbnailDimension768/https://api.grove.storage/abc123",
    );

    expect(
      pathPrefixedSdk.media.parseAudio(
        "https://audio.old.example.com/media/https://api.grove.storage/abc123",
      ),
    ).toBe("https://audio.new.example.com/media/https://api.grove.storage/abc123");
  });

  test("preserves local blob urls instead of gateway-wrapping them", () => {
    const sdk = createSDK({
      plugins: [
        mediaPlugin({
          imageGateway: "https://img.example.com",
          audioGateway: "https://audio.example.com",
        }),
      ],
    });

    expect(sdk.media.parseImage("blob:https://app.example.com/123")).toBe(
      "blob:https://app.example.com/123",
    );
    expect(sdk.media.parseAudio("blob:https://app.example.com/456")).toBe(
      "blob:https://app.example.com/456",
    );
  });

  test("preserves embedded data images instead of gateway-wrapping them", () => {
    const sdk = createSDK({
      plugins: [
        mediaPlugin({
          imageGateway: "https://img.example.com",
        }),
      ],
    });

    expect(sdk.media.parseImage("https://data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(
      sdk.media.parseImage(
        "https://img.example.com/thumbnailDimension768/https://data:image/png;base64,abc",
      ),
    ).toBe("data:image/png;base64,abc");
  });

  test("rejects scriptable media url schemes", () => {
    const sdk = createSDK({
      plugins: [mediaPlugin()],
    });

    expect(parseUrl("javascript:alert(1)")).toBeNull();
    expect(parseUrl("vbscript:msgbox(1)")).toBeNull();
    expect(sdk.media.parseImage("javascript:alert(1)")).toBeNull();
  });

  test("detects media mime categories", () => {
    expect(sdkCategory("audio/mpeg")).toBe("audio");
    expect(sdkCategory("video/mp4")).toBe("video");
    expect(sdkCategory("image/png")).toBe("image");
    expect(sdkCategory("application/json")).toBe("unknown");

    const sdk = createSDK({
      plugins: [mediaPlugin()],
    });

    expect(sdk.media.isAudioType("audio/mpeg")).toBe(true);
    expect(sdk.media.isVideoType("video/mp4")).toBe(true);
    expect(sdk.media.isImageType("image/png")).toBe(true);
  });
});

function sdkCategory(mimeType: string) {
  const sdk = createSDK({
    plugins: [mediaPlugin()],
  });

  return sdk.media.getMediaCategory(mimeType);
}
