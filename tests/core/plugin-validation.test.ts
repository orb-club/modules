import { describe, expect, test } from "vitest";

import { createSDK, SDKConfigurationError } from "../../src/index";

describe("plugin validation", () => {
  test("throws when a plugin requires a plugin name that is not yet installed", () => {
    expect(() =>
      createSDK({
        plugins: [
          {
            name: "auth-qr",
            namespace: "auth",
            extends: "auth",
            requires: ["auth"],
            setup: () => ({
              connectWithQr: () => "connected",
            }),
          },
        ],
      }),
    ).toThrowError(SDKConfigurationError);
  });

  test("throws when an extension plugin is installed before its base namespace exists", () => {
    expect(() =>
      createSDK({
        plugins: [
          {
            name: "auth-qr",
            namespace: "auth",
            extends: "auth",
            setup: () => ({
              connectWithQr: () => "connected",
            }),
          },
        ],
      }),
    ).toThrowError(SDKConfigurationError);
  });
});
