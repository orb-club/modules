const MAX_TIMER_MS = 2_147_483_647;

type VisibilityDocument = {
  visibilityState?: string;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
};

function toMs(expiresAt: Date | number | null | undefined): number | null {
  if (expiresAt instanceof Date) {
    const value = expiresAt.getTime();
    return Number.isFinite(value) ? value : null;
  }

  return typeof expiresAt === "number" && Number.isFinite(expiresAt) ? expiresAt : null;
}

/**
 * Calls `onExpire` once when `expiresAt` passes, and returns a function that
 * stops watching.
 *
 * Sign in with Orb issues no refresh token, so a session ends when its access
 * token does (about ten minutes). Use this to drop the signed-in UI at that
 * moment instead of showing a session whose token is dead. Background tabs
 * throttle timers, so the deadline is checked again whenever the page becomes
 * visible. A `null` expiry is treated as already expired.
 */
export function watchSessionExpiry(
  expiresAt: Date | number | null | undefined,
  onExpire: () => void,
): () => void {
  const deadline = toMs(expiresAt);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  const doc = (globalThis as { document?: VisibilityDocument }).document;

  const stop = () => {
    done = true;
    if (timer !== undefined) {
      globalThis.clearTimeout(timer);
      timer = undefined;
    }
    doc?.removeEventListener("visibilitychange", onVisible);
  };

  const check = () => {
    if (done) {
      return;
    }

    const remaining = deadline === null ? 0 : deadline - Date.now();
    if (remaining <= 0) {
      stop();
      onExpire();
      return;
    }

    if (timer !== undefined) {
      globalThis.clearTimeout(timer);
    }
    timer = globalThis.setTimeout(check, Math.min(remaining, MAX_TIMER_MS));
  };

  function onVisible() {
    if (doc?.visibilityState === "visible") {
      check();
    }
  }

  doc?.addEventListener("visibilitychange", onVisible);
  check();

  return stop;
}
