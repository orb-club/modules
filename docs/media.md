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
