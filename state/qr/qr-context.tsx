import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { DEFAULT_POLL_INTERVAL_MS } from "../../constants";
import { parseImage } from "../../media";
import { decodeJwt, initQrSignIn, pollQrSignIn } from "../../orb-auth";
import { useAuth } from "../auth/auth-context";
import type { UserSession } from "../types";
import { initialQrState, type QrState, qrReducer } from "./qr-reducer";

// =====================================================================
// Types
// =====================================================================

export type OnLoginSuccessCallback = (account: string, accessToken: string, handle: string) => void;

interface QrLoginContextValue {
  state: QrState;
  handleStartQrSignIn: () => void;
}

const QrLoginContext = createContext<QrLoginContextValue | null>(null);

// =====================================================================
// Provider
// =====================================================================

interface QrLoginProviderProps {
  children: ReactNode;
  onLoginSuccess?: OnLoginSuccessCallback;
  pollInterval?: number;
  autoStart?: boolean;
}

export function QrLoginProvider({
  children,
  onLoginSuccess,
  pollInterval = DEFAULT_POLL_INTERVAL_MS,
  autoStart = true,
}: QrLoginProviderProps) {
  const [state, dispatch] = useReducer(qrReducer, initialQrState);
  const { state: authState, dispatch: authDispatch } = useAuth();

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const autoStartRef = useRef(false);
  const onLoginSuccessRef = useRef(onLoginSuccess);
  onLoginSuccessRef.current = onLoginSuccess;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(
    (fn: () => void, ms: number) => {
      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) fn();
      }, ms);
    },
    [clearRetryTimer],
  );

  const resetForNewSession = useCallback((msg: string) => {
    dispatch({ type: "RESET_QR", message: msg });
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (secret: string) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        try {
          const res = await pollQrSignIn(secret);
          if (!mountedRef.current) return;
          const pollData = res.data?.data;
          const status = res.data?.status;

          if (status === "SUCCESS" && pollData?.processed === true) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);

            if (!pollData.accessToken) {
              dispatch({ type: "SET_QR_MESSAGE", message: "Sign-in failed: no access token" });
              scheduleRetry(() => handleStartQrSignInInner(), 2000);
              return;
            }

            const tokenPayload = decodeJwt(pollData.accessToken);
            const account =
              (tokenPayload?.act as { sub?: string })?.sub ??
              (tokenPayload?.sub as string | undefined);

            const rawHandle = pollData.handle || "user";
            const handle = rawHandle.startsWith("@") ? rawHandle.slice(1) : rawHandle;

            // Extract profile from enriched poll response
            const profile = res.data?.profile;

            const newUser: UserSession = {
              accessToken: pollData.accessToken,
              handle,
              avatarUrl: profile?.picture ? parseImage(profile.picture) : null,
              displayName: profile?.name ?? undefined,
              account,
              source: pollData.source,
              user_id: pollData.user_id,
              idToken: pollData.idToken,
              refreshToken: pollData.refreshToken,
              sessionCreatedAt: Date.now(),
            };

            authDispatch({ type: "SET_USER", user: newUser });
            dispatch({ type: "CLEAR_QR" });

            if (account && pollData.accessToken) {
              onLoginSuccessRef.current?.(account, pollData.accessToken, handle);
            }
          } else if (status === "FAILED") {
            resetForNewSession("Sign-in failed. Generating new QR...");
            scheduleRetry(() => handleStartQrSignInInner(), 1500);
          }
        } catch {
          // Continue polling
        }
      }, pollInterval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [authDispatch, resetForNewSession, scheduleRetry, pollInterval],
  );

  const handleStartQrSignInInner = useCallback(async () => {
    if (!mountedRef.current) return;
    resetForNewSession("Generating QR code...");
    try {
      const res = await initQrSignIn();
      if (!mountedRef.current) return;
      const qrCode = res.data?.data?.qrCode;
      const secret = res.data?.data?.secret;
      const deepLink = res.data?.data?.deepLink;
      if (!qrCode || !secret) {
        dispatch({ type: "SET_QR_MESSAGE", message: "Failed to get QR. Retrying..." });
        scheduleRetry(() => handleStartQrSignInInner(), 2000);
        return;
      }
      dispatch({
        type: "SET_QR_DATA",
        qrImage: qrCode,
        qrSecret: secret,
        qrDeepLink: deepLink || null,
        qrMessage: "Scan with Orb app to sign in",
      });
      startPolling(secret);
    } catch {
      if (!mountedRef.current) return;
      dispatch({ type: "SET_QR_MESSAGE", message: "Error generating QR. Retrying..." });
      scheduleRetry(() => handleStartQrSignInInner(), 2000);
    }
  }, [resetForNewSession, scheduleRetry, startPolling]);

  const handleStartQrSignIn = useCallback(() => {
    void handleStartQrSignInInner();
  }, [handleStartQrSignInInner]);

  useEffect(() => {
    if (!authState.hydrated || !autoStart) return;
    if (!authState.user && !autoStartRef.current) {
      autoStartRef.current = true;
      void handleStartQrSignInInner();
    }
  }, [authState.user, authState.hydrated, autoStart, handleStartQrSignInInner]);

  useEffect(() => {
    if (!authState.hydrated) return;
    if (authState.needsReauth) {
      void handleStartQrSignInInner();
    }
  }, [authState.needsReauth, authState.hydrated, handleStartQrSignInInner]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const value = useMemo<QrLoginContextValue>(
    () => ({
      state,
      handleStartQrSignIn,
    }),
    [state, handleStartQrSignIn],
  );

  return <QrLoginContext.Provider value={value}>{children}</QrLoginContext.Provider>;
}

// =====================================================================
// Hook
// =====================================================================

export function useQrLogin(): QrLoginContextValue {
  const ctx = useContext(QrLoginContext);
  if (!ctx) throw new Error("useQrLogin must be used within QrLoginProvider");
  return ctx;
}
