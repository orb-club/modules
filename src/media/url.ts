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

  const gateways = resolveGatewayConfig(config);

  if (url.startsWith("ipfs://")) {
    return joinGateway(gateways.ipfsGateway, stripIpfsPrefix(url.slice("ipfs://".length)));
  }

  if (url.startsWith("ar://")) {
    return joinGateway(gateways.arweaveGateway, url.slice("ar://".length));
  }

  if (url.startsWith("lens://")) {
    return joinGateway(gateways.lensGateway, url.slice("lens://".length));
  }

  const ipfsIndex = url.lastIndexOf("/ipfs/");
  if (ipfsIndex !== -1) {
    return joinGateway(gateways.ipfsGateway, url.slice(ipfsIndex + "/ipfs/".length));
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
    return url;
  }

  return `https://${url}`;
}
