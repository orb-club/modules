class MockXMLHttpRequest {
  readyState = 0;
  responseText = "";
  status = 0;

  open() {}

  send() {}

  abort() {}

  setRequestHeader() {}

  addEventListener() {}

  removeEventListener() {}
}

class MockAudio {
  pause() {}

  play() {
    return Promise.resolve();
  }
}

export function installBrowserShims() {
  const globalWithShims = globalThis as typeof globalThis & {
    XMLHttpRequest?: typeof MockXMLHttpRequest;
    Audio?: typeof MockAudio;
  };

  if (typeof globalWithShims.XMLHttpRequest === "undefined") {
    globalWithShims.XMLHttpRequest = MockXMLHttpRequest;
  }

  if (typeof globalWithShims.Audio === "undefined") {
    globalWithShims.Audio = MockAudio;
  }

  const urlGlobal = URL as unknown as {
    createObjectURL?: () => string;
    revokeObjectURL?: () => void;
  };

  if (typeof urlGlobal.createObjectURL !== "function") {
    Object.defineProperty(urlGlobal, "createObjectURL", {
      configurable: true,
      value: () => "blob:mock",
    });
  }

  if (typeof urlGlobal.revokeObjectURL !== "function") {
    Object.defineProperty(urlGlobal, "revokeObjectURL", {
      configurable: true,
      value: () => undefined,
    });
  }
}
