import type { MediaPluginConfig } from "./types";

const DEFAULT_IPFS_GATEWAY = "https://gw.ipfs-lens.dev/ipfs/";
const DEFAULT_ARWEAVE_GATEWAY = "https://arweave.net/";
const DEFAULT_LENS_GATEWAY = "https://api.grove.storage/";

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

function stripIpfsPrefix(path: string): string {
  return path.startsWith("ipfs/") ? path.slice("ipfs/".length) : path;
}

function stripThumbnailPrefix(url: string): string {
  let current = url;
  let changed = true;

  while (changed) {
    changed = false;

    const thumbnailMatch = current.match(
      /^(?:https?:\/\/[^/]+(?:\/[^/]+)*\/)?thumbnailDimension\d+\/(.+)$/,
    );
    if (thumbnailMatch?.[1]) {
      current = thumbnailMatch[1];
      changed = true;
    }
  }

  return current;
}

function normalizeDataUrl(url: string): string | null {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("https://data:")) return url.slice("https://".length);
  if (url.startsWith("http://data:")) return url.slice("http://".length);
  return null;
}

function isUnsafeUrlScheme(url: string): boolean {
  return /^(?:javascript|vbscript):/i.test(url);
}

function resolveGatewayConfig(config?: MediaPluginConfig) {
  return {
    ipfsGateway: config?.ipfsGateway ?? DEFAULT_IPFS_GATEWAY,
    arweaveGateway: config?.arweaveGateway ?? DEFAULT_ARWEAVE_GATEWAY,
    lensGateway: config?.lensGateway ?? DEFAULT_LENS_GATEWAY,
  };
}

export function parseUrl(
  url: string | null | undefined,
  config?: MediaPluginConfig,
): string | null {
  if (!url) return null;

  const cleanUrl = stripThumbnailPrefix(url);
  if (isUnsafeUrlScheme(cleanUrl)) return null;

  const dataUrl = normalizeDataUrl(cleanUrl);
  if (dataUrl) return dataUrl;

  const gateways = resolveGatewayConfig(config);

  const ipfsUriIndex = cleanUrl.lastIndexOf("ipfs://");
  if (ipfsUriIndex !== -1) {
    return joinGateway(
      gateways.ipfsGateway,
      stripIpfsPrefix(cleanUrl.slice(ipfsUriIndex + "ipfs://".length)),
    );
  }

  const arweaveUriIndex = cleanUrl.lastIndexOf("ar://");
  if (arweaveUriIndex !== -1) {
    return joinGateway(gateways.arweaveGateway, cleanUrl.slice(arweaveUriIndex + "ar://".length));
  }

  if (cleanUrl.startsWith("lens://")) {
    return joinGateway(gateways.lensGateway, cleanUrl.slice("lens://".length));
  }

  const ipfsIndex = cleanUrl.lastIndexOf("/ipfs/");
  if (ipfsIndex !== -1) {
    return joinGateway(gateways.ipfsGateway, cleanUrl.slice(ipfsIndex + "/ipfs/".length));
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(cleanUrl)) {
    return cleanUrl;
  }

  return cleanUrl;
}
