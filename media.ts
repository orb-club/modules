/// <reference lib="dom" />
/**
 * @module media
 *
 * Media MIME type enums, category detection, and
 * IPFS / Arweave / Lens URI to gateway URL resolution.
 *
 * @example
 *   import { parseUrl, parseMedia, parseImage, parseAudioUrl, parseVideoUrl } from '@orb-club/modules/media'
 *
 *   parseUrl('lens://abc123')                          // 'https://api.grove.storage/abc123'
 *   parseMedia('lens://abc123', { type: 'audio', config: { audioGateway: 'https://audio.example.com' } })
 *   parseImage('lens://abc123', 768, { mediaGateway: 'https://cdn.example.com' })
 *   parseAudioUrl('lens://abc123', { audioGateway: 'https://audio.example.com' })
 *   parseVideoUrl('ipfs://Qm...')                      // 'https://gw.ipfs-lens.dev/ipfs/Qm...'
 */

import {
  ARWEAVE_GATEWAY,
  DEFAULT_THUMBNAIL_DIMENSION,
  IPFS_GATEWAY,
  LENS_GATEWAY,
} from "./constants";

// =====================================================================
// MIME type enums
// =====================================================================

export enum MediaAudioMimeType {
  WAV = "audio/wav",
  WAV_VND = "audio/vnd.wave",
  MP3 = "audio/mpeg",
  OGG_AUDIO = "audio/ogg",
  MP4_AUDIO = "audio/mp4",
  AAC = "audio/aac",
  WEBM_AUDIO = "audio/webm",
  FLAC = "audio/flac",
}

export enum MediaVideoMimeType {
  GLTF = "model/gltf+json",
  GLTF_BINARY = "model/gltf-binary",
  M4V = "video/x-m4v",
  MOV = "video/mov",
  MP4 = "video/mp4",
  MPEG = "video/mpeg",
  OGG = "video/ogg",
  OGV = "video/ogv",
  QUICKTIME = "video/quicktime",
  WEBM = "video/webm",
}

export enum MediaImageMimeType {
  AVIF = "image/avif",
  BMP = "image/bmp",
  GIF = "image/gif",
  HEIC = "image/heic",
  JPEG = "image/jpeg",
  PNG = "image/png",
  SVG_XML = "image/svg+xml",
  TIFF = "image/tiff",
  WEBP = "image/webp",
  X_MS_BMP = "image/x-ms-bmp",
}

/** All supported MIME types as a flat array. */
export const SUPPORTED_MEDIA_TYPES = [
  ...Object.values(MediaAudioMimeType),
  ...Object.values(MediaVideoMimeType),
  ...Object.values(MediaImageMimeType),
] as const;

/** Comma-separated accept string for <input type="file"> elements. */
export const MEDIA_ACCEPT_STRING = SUPPORTED_MEDIA_TYPES.join(",");

/** Audio-only accept string for <input type="file"> elements. */
export const AUDIO_ACCEPT_STRING = Object.values(MediaAudioMimeType).join(",");

// =====================================================================
// Category detection
// =====================================================================

const AUDIO_SET: ReadonlySet<string> = new Set(Object.values(MediaAudioMimeType));
const VIDEO_SET: ReadonlySet<string> = new Set(Object.values(MediaVideoMimeType));
const IMAGE_SET: ReadonlySet<string> = new Set(Object.values(MediaImageMimeType));

/** Classify a MIME type into audio / video / image / unknown. */
export function getMediaCategory(mimeType: string): "audio" | "video" | "image" | "unknown" {
  if (AUDIO_SET.has(mimeType)) return "audio";
  if (VIDEO_SET.has(mimeType)) return "video";
  if (IMAGE_SET.has(mimeType)) return "image";
  return "unknown";
}

/** Check if a MIME type is an audio type. */
export function isAudioType(mimeType: string): boolean {
  return AUDIO_SET.has(mimeType);
}

/** Check if a MIME type is a video type. */
export function isVideoType(mimeType: string): boolean {
  return VIDEO_SET.has(mimeType);
}

/** Check if a MIME type is an image type. */
export function isImageType(mimeType: string): boolean {
  return IMAGE_SET.has(mimeType);
}

// =====================================================================
// URL config
// =====================================================================

export interface MediaUrlConfig {
  /** Media thumbnail gateway. */
  mediaGateway?: string;
  /** Audio CDN gateway. */
  audioGateway?: string;
  /** IPFS gateway host. */
  ipfsGateway?: string;
  /** Arweave gateway host. */
  arweaveGateway?: string;
  /** Lens/Grove gateway host. */
  lensGateway?: string;
}

function getUrlDefaults(): MediaUrlConfig {
  const env = typeof process !== "undefined" ? process.env : undefined;
  return {
    mediaGateway: env?.ORB_MEDIA_GATEWAY,
    audioGateway: env?.ORB_AUDIO_GATEWAY,
    ipfsGateway: env?.ORB_IPFS_GATEWAY ?? IPFS_GATEWAY,
    arweaveGateway: env?.ORB_ARWEAVE_GATEWAY ?? ARWEAVE_GATEWAY,
    lensGateway: env?.ORB_LENS_GATEWAY ?? LENS_GATEWAY,
  };
}

const URL_DEFAULTS = getUrlDefaults();

function withGateway(gateway: string | undefined, path: string): string {
  if (!gateway) return path;
  return `${gateway.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

// =====================================================================
// parseUrl — low-level protocol resolver
// =====================================================================

/**
 * Resolve a protocol URI (ipfs://, ar://, lens://) or legacy IPFS gateway
 * URL to a canonical HTTPS gateway URL.
 *
 * Autodetects IPFS URLs by looking for `/ipfs/` in the path — no hardcoded
 * list of legacy gateway domains needed.
 */
export function parseUrl(url: string | null | undefined, config?: MediaUrlConfig): string | null {
  if (!url) return null;

  const cfg = { ...URL_DEFAULTS, ...config };

  // Protocol prefixes
  if (url.startsWith("ipfs://")) {
    return `https://${cfg.ipfsGateway}${url.slice(7)}`;
  }
  if (url.startsWith("ar://")) {
    return `https://${cfg.arweaveGateway}${url.slice(5)}`;
  }
  if (url.startsWith("lens://")) {
    return `https://${cfg.lensGateway}${url.slice(7)}`;
  }

  // Autodetect any HTTPS URL containing /ipfs/ — extract CID + path
  const ipfsIndex = url.lastIndexOf("/ipfs/");
  if (ipfsIndex !== -1) {
    const cidAndPath = url.slice(ipfsIndex + 6);
    return `https://${cfg.ipfsGateway}${cidAndPath}`;
  }

  // Ensure https://
  return url.startsWith("https://") ? url : `https://${url}`;
}

// =====================================================================
// parseMedia — gateway-aware media URL resolver
// =====================================================================

export type MediaCategory = "audio" | "video" | "image";

export interface ParseMediaOptions {
  /** Media category or MIME type string. MIME types are auto-detected. Default: 'image'. */
  type?: MediaCategory | string;
  /** Thumbnail dimension (images only). */
  dimension?: number;
  /** Return the raw resolved URL without any CDN wrapping. */
  raw?: boolean;
  /** Gateway config overrides. */
  config?: MediaUrlConfig;
}

/**
 * Resolve a media URL through the appropriate CDN gateway.
 *
 * - `image` (default) -> thumbnail gateway when configured
 * - `audio` -> audio gateway when configured
 * - `video` -> raw resolved URL
 *
 * Accepts either a category string ('audio', 'video', 'image') or a MIME
 * type string ('audio/mpeg', 'video/mp4') which is auto-detected via
 * `getMediaCategory()`.
 *
 * Pass `raw: true` to get the resolved URL without any CDN wrapping.
 */
export function parseMedia(
  url: string | null | undefined,
  options?: ParseMediaOptions,
): string | null {
  if (!url) return null;

  const {
    type = "image",
    dimension = DEFAULT_THUMBNAIL_DIMENSION,
    raw = false,
    config,
  } = options ?? {};

  const cfg = { ...URL_DEFAULTS, ...config };

  // Data URLs pass through
  if (url.startsWith("data:")) return url;

  // Strip existing gateway wrappers to get back to the raw URI.
  // Loop to handle nested wrapping without depending on specific hostnames.
  let stripped = url;
  let changed = true;
  while (changed) {
    changed = false;
    const thumbMatch = stripped.match(/thumbnailDimension\d+\/(.*)/);
    if (thumbMatch?.[1]) {
      stripped = thumbMatch[1];
      changed = true;
    }

    const nestedHttpMatch = stripped.match(/^https?:\/\/[^/]+\/(https?:\/\/.*)$/);
    if (nestedHttpMatch?.[1]) {
      stripped = nestedHttpMatch[1];
      changed = true;
    }
  }

  // Resolve protocol URIs
  const resolved = parseUrl(stripped, cfg);
  if (!resolved) return null;

  // Raw mode — return the resolved URL without CDN wrapping
  if (raw) return resolved;

  // Determine category — accept direct category or auto-detect from MIME
  let category: MediaCategory;
  if (type === "audio" || type === "video" || type === "image") {
    category = type;
  } else {
    const detected = getMediaCategory(type);
    category = detected === "unknown" ? "image" : detected;
  }

  switch (category) {
    case "audio":
      return withGateway(cfg.audioGateway, resolved);
    case "video":
      return resolved;
    default:
      if (resolved.endsWith(".svg")) return resolved;
      return cfg.mediaGateway
        ? withGateway(cfg.mediaGateway, `thumbnailDimension${dimension}/${resolved}`)
        : resolved;
  }
}

// =====================================================================
// Convenience wrappers
// =====================================================================

/** Parse an image URL through the thumbnail gateway. */
export function parseImage(
  url: string | null | undefined,
  dimension = DEFAULT_THUMBNAIL_DIMENSION,
  config?: MediaUrlConfig,
): string | null {
  return parseMedia(url, { type: "image", dimension, config });
}

/** Parse an audio URL through the audio CDN gateway. */
export function parseAudioUrl(
  url: string | null | undefined,
  config?: MediaUrlConfig,
): string | null {
  return parseMedia(url, { type: "audio", config });
}

/** Parse a video URL to a raw resolved gateway URL (no CDN wrapping). */
export function parseVideoUrl(
  url: string | null | undefined,
  config?: MediaUrlConfig,
): string | null {
  return parseMedia(url, { type: "video", config });
}

// =====================================================================
// Deprecated (backward compat)
// =====================================================================

/**
 * @deprecated Use `parseUrl()` instead.
 */
export function parseIPFS(url: string, config?: MediaUrlConfig): string | null {
  return parseUrl(url, config);
}

/**
 * @deprecated Use `parseMedia()`, `parseImage()`, `parseAudioUrl()`, or `parseVideoUrl()` instead.
 */
export function transformMediaUrl(
  url: string | null | undefined,
  dimension = DEFAULT_THUMBNAIL_DIMENSION,
  config?: MediaUrlConfig,
): string | null {
  return parseMedia(url, { type: "image", dimension, config });
}

// =====================================================================
// Audio metadata helper
// =====================================================================

/**
 * Extract audio duration from a File using an HTMLAudioElement.
 * Returns duration in seconds, or null on failure.
 *
 * Browser-only (requires DOM).
 */
export function getAudioDuration(file: File): Promise<number | null> {
  if (typeof Audio === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    });
    audio.src = objectUrl;
  });
}
