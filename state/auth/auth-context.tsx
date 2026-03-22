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
import {
  DEFAULT_REFRESH_BUFFER_S,
  DEFAULT_REFRESH_INTERVAL_MS,
  DEFAULT_SESSION_MAX_AGE_MS,
  DEFAULT_STORAGE_KEY,
} from "../../constants";
import { isTokenExpired, refreshTokens, tokenExpiresWithin } from "../../orb-auth";
import type { UserSession } from "../types";
import { type AuthAction, type AuthState, authReducer, initialAuthState } from "./auth-reducer";

// =====================================================================
// Context value
// =====================================================================

interface AuthContextValue {
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
  activeUser: UserSession | null;
  isLoggedIn: boolean;
  ensureValidToken: () => Promise<UserSession | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// =====================================================================
// Provider
// =====================================================================

interface AuthProviderProps {
  children: ReactNode;
  /** localStorage key for persisting session. Default: 'orb_auth' */
  storageKey?: string;
  /** Max session age in ms before auto-clear on refresh failure. Default: 24h */
  sessionMaxAge?: number;
  /** Token refresh check interval in ms. Default: 10s */
  refreshInterval?: number;
  /** Seconds before expiry to trigger refresh. Default: 60 */
  refreshBuffer?: number;
}

export function AuthProvider({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
  sessionMaxAge = DEFAULT_SESSION_MAX_AGE_MS,
  refreshInterval = DEFAULT_REFRESH_INTERVAL_MS,
  refreshBuffer = DEFAULT_REFRESH_BUFFER_S,
}: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const initialValidationDoneRef = useRef(false);

  const activeUser = state.user;
  const isLoggedIn = state.user !== null;

  // ---------------------------------------------------------------
  // ensureValidToken — check/refresh JWT before API calls
  // ---------------------------------------------------------------
  const ensureValidToken = useCallback(async (): Promise<UserSession | null> => {
    if (!state.user) return null;

    if (!isTokenExpired(state.user.accessToken)) {
      return state.user;
    }

    if (state.user.refreshToken) {
      const result = await refreshTokens(state.user.refreshToken);
      if (result.ok && result.accessToken) {
        const updates: Partial<UserSession> = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? state.user.refreshToken,
          idToken: result.idToken ?? state.user.idToken,
        };
        dispatch({ type: "UPDATE_USER", updates });
        return { ...state.user, ...updates };
      }
    }

    dispatch({ type: "SET_NEEDS_REAUTH", needsReauth: true });
    return null;
  }, [state.user]);

  // ---------------------------------------------------------------
  // Effect: Hydrate from localStorage
  // ---------------------------------------------------------------
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as UserSession;
        if (parsed?.accessToken && parsed?.handle) {
          dispatch({ type: "SET_USER", user: parsed });
        }
      }
    } catch {
      // Invalid stored data
    }
    dispatch({ type: "SET_HYDRATED" });
  }, [storageKey]);

  // ---------------------------------------------------------------
  // Effect: Persist user to localStorage
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!state.hydrated) return;
    if (state.user) {
      localStorage.setItem(storageKey, JSON.stringify(state.user));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [state.user, state.hydrated, storageKey]);

  // ---------------------------------------------------------------
  // Effect: Validate token on initial load
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!state.hydrated || !state.user || initialValidationDoneRef.current) return;

    const validate = async () => {
      const user = state.user!;
      const now = Date.now();
      const sessionAge = user.sessionCreatedAt ? now - user.sessionCreatedAt : 0;
      const isStale = sessionAge > sessionMaxAge;

      if (!isTokenExpired(user.accessToken)) {
        initialValidationDoneRef.current = true;
        return;
      }

      if (user.refreshToken) {
        const result = await refreshTokens(user.refreshToken);
        if (result.ok && result.accessToken) {
          dispatch({
            type: "UPDATE_USER",
            updates: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken ?? user.refreshToken,
              sessionCreatedAt: user.sessionCreatedAt ?? now,
            },
          });
          initialValidationDoneRef.current = true;
          return;
        }
      }

      if (isStale) {
        dispatch({ type: "REMOVE_USER" });
      } else {
        dispatch({ type: "SET_NEEDS_REAUTH", needsReauth: true });
      }
      initialValidationDoneRef.current = true;
    };

    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  // ---------------------------------------------------------------
  // Effect: Periodic token refresh
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!state.user?.accessToken || !initialValidationDoneRef.current) return;

    let isRefreshing = false;

    const check = async () => {
      if (!state.user || isRefreshing) return;
      if (tokenExpiresWithin(state.user.accessToken, refreshBuffer) && state.user.refreshToken) {
        isRefreshing = true;
        const result = await refreshTokens(state.user.refreshToken);
        if (result.ok && result.accessToken) {
          dispatch({
            type: "UPDATE_USER",
            updates: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken ?? state.user.refreshToken,
              idToken: result.idToken ?? state.user.idToken,
            },
          });
        } else {
          dispatch({ type: "SET_NEEDS_REAUTH", needsReauth: true });
        }
        isRefreshing = false;
      }
    };

    check();
    const interval = setInterval(check, refreshInterval);
    return () => clearInterval(interval);
  }, [state.user?.accessToken, state.user?.refreshToken, refreshBuffer, refreshInterval]);

  // ---------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      dispatch,
      activeUser,
      isLoggedIn,
      ensureValidToken,
    }),
    [state, activeUser, isLoggedIn, ensureValidToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =====================================================================
// Hook
// =====================================================================

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
