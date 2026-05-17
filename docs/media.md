# Media

Import:

```ts
import { mediaPlugin } from "@orb-club/modules/media";
```

`mediaPlugin(...)` adds `sdk.media`.

Capabilities:

- `parse(url, options?)`
- `parseImage(url, dimension?)`
- `parseAudio(url)`
- `parseVideo(url)`
- `getMediaCategory(mimeType)`
- `isAudioType(mimeType)`
- `isVideoType(mimeType)`
- `isImageType(mimeType)`

Common config:

- `imageGateway`
- `audioGateway`
- `ipfsGateway`
- `arweaveGateway`
- `lensGateway`
- `defaultThumbnailDimension`

Normalization behavior:

- `ipfs://`, `ar://`, and `lens://` inputs resolve through their configured gateways.
- Storage URIs embedded inside wrapper URLs are resolved from the embedded URI.
- Existing `thumbnailDimension...` proxy prefixes are stripped before gateway wrapping, so callers can change dimensions without double-wrapping.
- `data:`, `blob:`, and `file:` URLs are preserved.
- `javascript:` and `vbscript:` URLs return `null`.
- Bare paths without a recognized URI scheme are returned unchanged.

Example:

```ts
const sdk = createSDK({
  plugins: [
    mediaPlugin({
      imageGateway: "https://cdn.example.com",
      audioGateway: "https://audio.example.com",
    }),
  ],
});

sdk.media.parseImage("lens://asset", 768);
sdk.media.parseAudio("ipfs://QmExample");
sdk.media.parse("ar://example", { type: "image" });
```
