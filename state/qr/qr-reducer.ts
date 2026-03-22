// =====================================================================
// State
// =====================================================================

export interface QrState {
  qrImage: string | null;
  qrSecret: string | null;
  qrMessage: string | null;
  qrDeepLink: string | null;
}

export const initialQrState: QrState = {
  qrImage: null,
  qrSecret: null,
  qrMessage: null,
  qrDeepLink: null,
};

// =====================================================================
// Actions
// =====================================================================

export type QrAction =
  | {
      type: "SET_QR_DATA";
      qrImage: string;
      qrSecret: string;
      qrDeepLink: string | null;
      qrMessage: string;
    }
  | { type: "SET_QR_MESSAGE"; message: string | null }
  | { type: "RESET_QR"; message: string }
  | { type: "CLEAR_QR" };

// =====================================================================
// Reducer
// =====================================================================

export function qrReducer(state: QrState, action: QrAction): QrState {
  switch (action.type) {
    case "SET_QR_DATA":
      return {
        ...state,
        qrImage: action.qrImage,
        qrSecret: action.qrSecret,
        qrDeepLink: action.qrDeepLink,
        qrMessage: action.qrMessage,
      };

    case "SET_QR_MESSAGE":
      return { ...state, qrMessage: action.message };

    case "RESET_QR":
      return {
        ...state,
        qrImage: null,
        qrSecret: null,
        qrDeepLink: null,
        qrMessage: action.message,
      };

    case "CLEAR_QR":
      return initialQrState;

    default:
      return state;
  }
}
