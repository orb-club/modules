/**
 * @module grove-upload
 *
 * Direct browser-side file upload to Lens Grove Storage.
 * Uses XHR for upload progress tracking. Bypasses serverless function
 * payload limits (e.g., Vercel's 4.5 MB) by uploading from the browser.
 *
 * Flow: allocate storage key → multipart upload (file + ACL) → poll propagation
 *
 * @example
 *   import { uploadFile } from '@/modules/grove-upload'
 *
 *   const result = await uploadFile(file, '0x...account', (p) => setProgress(p))
 *   if (result.ok) {
 *     console.log(result.uri)        // lens://...
 *     console.log(result.gatewayUrl)  // https://api.grove.storage/...
 *   }
 */

import {
  GROVE_POLL_INTERVAL_MS,
  GROVE_PROPAGATION_TIMEOUT_MS,
  LENS_CHAIN_ID,
  LENS_GATEWAY,
} from "./constants";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface GroveConfig {
  /** Grove Storage API base URL. */
  backendUrl?: string;
  /** Lens chain ID for ACL. */
  chainId?: number;
  /** ACL template name. Default: lens_account */
  aclTemplate?: string;
  /** Max ms to wait for propagation. */
  propagationTimeout?: number;
  /** Ms between propagation polls. */
  pollInterval?: number;
}

const DEFAULTS: Required<GroveConfig> = {
  backendUrl: `https://${LENS_GATEWAY.replace(/\/$/, "")}`,
  chainId: LENS_CHAIN_ID,
  aclTemplate: "lens_account",
  propagationTimeout: GROVE_PROPAGATION_TIMEOUT_MS,
  pollInterval: GROVE_POLL_INTERVAL_MS,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  ok: boolean;
  message: string;
  /** Lens storage URI (e.g., lens://...) */
  uri?: string;
  /** Direct gateway URL */
  gatewayUrl?: string;
  /** Storage key (useful for status polling) */
  storageKey?: string;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a file to Grove Storage with progress tracking.
 *
 * Progress: 0-90 = upload, 90-100 = propagation wait.
 *
 * @param file       - File to upload
 * @param account    - Lens account address (used for ACL)
 * @param onProgress - Optional callback receiving 0-100
 * @param config     - Optional overrides for backend URL, chain ID, etc.
 */
export async function uploadFile(
  file: File,
  account: string,
  onProgress?: (progress: number) => void,
  config?: GroveConfig,
): Promise<UploadResult> {
  const cfg = { ...DEFAULTS, ...config };

  try {
    onProgress?.(0);

    // 1. Allocate a storage key
    const allocRes = await fetch(`${cfg.backendUrl}/link/new?amount=1`, {
      method: "POST",
    });
    if (!allocRes.ok) throw new Error("Failed to allocate storage");
    const [allocation] = await allocRes.json();
    const { storage_key: storageKey, uri } = allocation;

    // 2. Upload file + Lens ACL via XHR (for progress events)
    const acl = {
      template: cfg.aclTemplate,
      [cfg.aclTemplate]: account,
      chain_id: cfg.chainId,
    };
    const aclBlob = new File([JSON.stringify(acl)], "lens-acl.json", { type: "application/json" });

    const form = new FormData();
    form.append(storageKey, file, file.name);
    form.append("lens-acl.json", aclBlob, "lens-acl.json");

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 90));
        }
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      });
      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.open("POST", `${cfg.backendUrl}/${storageKey}`);
      xhr.send(form);
    });

    // 3. Wait for propagation
    const t0 = Date.now();
    while (Date.now() - t0 < cfg.propagationTimeout) {
      const res = await fetch(`${cfg.backendUrl}/status/${storageKey}`);
      if (res.ok) {
        const d = await res.json();
        if (d.status === "done" || d.status === "available") break;
        if (d.status?.startsWith("error") || d.status === "unauthorized") {
          throw new Error(`Storage error: ${d.status}`);
        }
      }
      await new Promise((r) => setTimeout(r, cfg.pollInterval));
    }

    onProgress?.(100);

    return {
      ok: true,
      message: "File uploaded",
      uri,
      gatewayUrl: `${cfg.backendUrl}/${storageKey}`,
      storageKey,
    };
  } catch (error) {
    console.error("[Grove Upload Error]", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
