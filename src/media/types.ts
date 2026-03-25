import type { SDKPlugin } from "../core/types";

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

export const SUPPORTED_MEDIA_TYPES = [
  ...Object.values(MediaAudioMimeType),
  ...Object.values(MediaVideoMimeType),
  ...Object.values(MediaImageMimeType),
] as const;

export const MEDIA_ACCEPT_STRING = SUPPORTED_MEDIA_TYPES.join(",");
export const AUDIO_ACCEPT_STRING = Object.values(MediaAudioMimeType).join(",");

export type MediaCategory = "audio" | "video" | "image" | "unknown";

const AUDIO_SET: ReadonlySet<string> = new Set(Object.values(MediaAudioMimeType));
const VIDEO_SET: ReadonlySet<string> = new Set(Object.values(MediaVideoMimeType));
const IMAGE_SET: ReadonlySet<string> = new Set(Object.values(MediaImageMimeType));

export function getMediaCategory(mimeType: string): MediaCategory {
  if (AUDIO_SET.has(mimeType)) return "audio";
  if (VIDEO_SET.has(mimeType)) return "video";
  if (IMAGE_SET.has(mimeType)) return "image";
  return "unknown";
}

export function isAudioType(mimeType: string): boolean {
  return AUDIO_SET.has(mimeType);
}

export function isVideoType(mimeType: string): boolean {
  return VIDEO_SET.has(mimeType);
}

export function isImageType(mimeType: string): boolean {
  return IMAGE_SET.has(mimeType);
}

export type MediaPluginConfig = {
  imageGateway?: string;
  audioGateway?: string;
  ipfsGateway?: string;
  arweaveGateway?: string;
  lensGateway?: string;
  defaultThumbnailDimension?: number;
};

export type MediaParseOptions = {
  type?: Exclude<MediaCategory, "unknown"> | string;
  dimension?: number;
  raw?: boolean;
};

export type MediaCapabilities = {
  parse: (url: string | null | undefined, options?: MediaParseOptions) => string | null;
  parseImage: (url: string | null | undefined, dimension?: number) => string | null;
  parseAudio: (url: string | null | undefined) => string | null;
  parseVideo: (url: string | null | undefined) => string | null;
  getMediaCategory: typeof getMediaCategory;
  isAudioType: typeof isAudioType;
  isVideoType: typeof isVideoType;
  isImageType: typeof isImageType;
};

export type MediaPlugin = SDKPlugin<"media", MediaCapabilities>;
