import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "auth/index": "src/auth/index.ts",
    "auth/qr/index": "src/auth/qr/index.ts",
    "auth/lens/index": "src/auth/lens/index.ts",
    "media/index": "src/media/index.ts",
    "upload/grove/index": "src/upload/grove/index.ts",
    "transport/backend/index": "src/transport/backend/index.ts",
  },
  format: ["esm", "cjs"],
  bundle: true,
  clean: true,
  dts: true,
  sourcemap: true,
  target: "es2022",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
});
