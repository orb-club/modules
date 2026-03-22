export interface UserSession {
  accessToken: string;
  handle: string;
  avatarUrl: string | null;
  displayName?: string;
  account?: string;
  source?: string;
  user_id?: string;
  idToken?: string;
  refreshToken?: string;
  sessionCreatedAt?: number;
}
