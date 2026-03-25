import type {
  MediaCapabilities,
  MediaCategory,
  MediaParseOptions,
  MediaPlugin,
  MediaPluginConfig,
} from "./types";
import { getMediaCategory, isAudioType, isImageType, isVideoType } from "./types";
import { parseUrl } from "./url";

const DEFAULT_THUMBNAIL_DIMENSION = 768;

function normalizeGateway(gateway: string): string {
  const trimmed = gateway.replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function joinGateway(gateway: string, suffix: string): string {
  return `${normalizeGateway(gateway)}/${suffix.replace(/^\/+/, "")}`;
}

function shouldBypassGateway(url: string): boolean {
  if (url.startsWith("data:")) {
    return true;
  }

  if (url.startsWith("blob:") || url.startsWith("file:")) {
    return true;
  }

  return false;
}

function resolveCategory(type: MediaParseOptions["type"]): Exclude<MediaCategory, "unknown"> {
  if (type === "audio" || type === "video" || type === "image") {
    return type;
  }

  const detected = type ? getMediaCategory(type) : "image";
  return detected === "unknown" ? "image" : detected;
}

function stripWrapping(url: string): string {
  let current = url;
  let changed = true;

  while (changed) {
    changed = false;

    const nestedHttpMatch = current.match(/^https?:\/\/.+\/(https?:\/\/.*)$/);
    if (nestedHttpMatch?.[1]) {
      current = nestedHttpMatch[1];
      changed = true;
      continue;
    }

    const thumbnailMatch = current.match(/^https?:\/\/.+\/thumbnailDimension\d+\/(https?:\/\/.*)$/);
    if (thumbnailMatch?.[1]) {
      current = thumbnailMatch[1];
      changed = true;
      continue;
    }

    const localThumbnailMatch = current.match(/^thumbnailDimension\d+\/(.+)$/);
    if (localThumbnailMatch?.[1]) {
      current = localThumbnailMatch[1];
      changed = true;
    }
  }

  return current;
}

function createMediaCapabilities(config: MediaPluginConfig = {}): MediaCapabilities {
  const defaultThumbnailDimension = config.defaultThumbnailDimension ?? DEFAULT_THUMBNAIL_DIMENSION;

  const parse: MediaCapabilities["parse"] = (url, options) => {
    if (!url) return null;
    if (shouldBypassGateway(url)) return url;

    const { dimension = defaultThumbnailDimension, raw = false } = options ?? {};
    const category = resolveCategory(options?.type);
    const resolved = parseUrl(stripWrapping(url), config);

    if (!resolved || raw || category === "video" || shouldBypassGateway(resolved)) {
      return resolved;
    }

    if (category === "audio") {
      return config.audioGateway ? joinGateway(config.audioGateway, resolved) : resolved;
    }

    if (resolved.endsWith(".svg")) {
      return resolved;
    }

    return config.imageGateway
      ? joinGateway(config.imageGateway, `thumbnailDimension${dimension}/${resolved}`)
      : resolved;
  };

  return {
    parse,
    parseImage: (url, dimension = defaultThumbnailDimension) =>
      parse(url, { type: "image", dimension }),
    parseAudio: (url) => parse(url, { type: "audio" }),
    parseVideo: (url) => parse(url, { type: "video" }),
    getMediaCategory,
    isAudioType,
    isVideoType,
    isImageType,
  };
}

export function mediaPlugin(config: MediaPluginConfig = {}): MediaPlugin {
  return {
    name: "media",
    namespace: "media",
    setup: () => createMediaCapabilities(config),
  };
}
