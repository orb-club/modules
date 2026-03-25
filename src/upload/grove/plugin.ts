import type { GroveUploadPlugin, GroveUploadPluginConfig } from "./types";
import { uploadFile } from "./upload";

export function groveUploadPlugin(config: GroveUploadPluginConfig = {}): GroveUploadPlugin {
  return {
    name: "upload-grove",
    namespace: "upload",
    setup: (context) => ({
      uploadFile: (input) => uploadFile(context, config, input),
    }),
  };
}
