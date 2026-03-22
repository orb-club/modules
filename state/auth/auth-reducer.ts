import type { UserSession } from "../types";

// =====================================================================
// State
// =====================================================================

export interface AuthState {
  user: UserSession | null;
  hydrated: boolean;
  needsReauth: boolean;
  isLoadingUserData: boolean;
}

export const initialAuthState: AuthState = {
  user: null,
  hydrated: false,
  needsReauth: false,
  isLoadingUserData: false,
};

// =====================================================================
// Actions
// =====================================================================

export type AuthAction =
  | { type: "SET_HYDRATED" }
  | { type: "SET_USER"; user: UserSession | null }
  | { type: "UPDATE_USER"; updates: Partial<UserSession> }
  | { type: "REMOVE_USER" }
  | { type: "SET_NEEDS_REAUTH"; needsReauth: boolean }
  | { type: "SET_LOADING"; loading: boolean };

// =====================================================================
// Reducer
// =====================================================================

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_HYDRATED":
      return { ...state, hydrated: true };

    case "SET_USER":
      return { ...state, user: action.user, needsReauth: false };

    case "UPDATE_USER":
      return state.user ? { ...state, user: { ...state.user, ...action.updates } } : state;

    case "REMOVE_USER":
      return { ...state, user: null, needsReauth: false };

    case "SET_NEEDS_REAUTH":
      return { ...state, needsReauth: action.needsReauth };

    case "SET_LOADING":
      return { ...state, isLoadingUserData: action.loading };

    default:
      return state;
  }
}
