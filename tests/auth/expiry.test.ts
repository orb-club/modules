import { afterEach, describe, expect, test, vi } from "vitest";

import { watchSessionExpiry } from "../../src/auth";

describe("watchSessionExpiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("fires once when the access token expires", async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    watchSessionExpiry(Date.now() + 600_000, onExpire);

    await vi.advanceTimersByTimeAsync(599_999);
    expect(onExpire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  test("treats a missing or past expiry as already expired", () => {
    const onExpire = vi.fn();
    watchSessionExpiry(null, onExpire);
    watchSessionExpiry(new Date(Date.now() - 1), onExpire);
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  test("stops when the returned function is called", async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const stop = watchSessionExpiry(Date.now() + 1_000, onExpire);
    stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
