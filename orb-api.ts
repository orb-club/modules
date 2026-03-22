/**
 * @module orb-api
 *
 * Typed client for the Orb backend API.
 *
 * Every function calls a Next.js API route proxy (not the backend directly).
 * Use `modules/orb-proxy.ts` → `createOrbRoute()` to create those routes
 * with a single line each.
 *
 * @example
 *   import { createPostTx, getUser, getClubs } from '@/modules/orb-api'
 *
 *   const user = await getUser(address, accessToken)
 *   const clubs = await getClubs(accessToken)
 *   const result = await createPostTx({ content: 'gm', handle, locale: 'en', xAccessToken })
 */

// =====================================================================
// Configuration
// =====================================================================

export interface OrbApiConfig {
  /** Base URL prefix for API route proxies. Default: '' (same origin). */
  apiBase?: string;
}

// =====================================================================
// Types — Media
// =====================================================================

export interface MediaItem {
  /** URI (e.g., lens://, ipfs://) */
  item: string;
  /** MIME type (e.g., image/jpeg) */
  type: string;
  /** Cover image URI (for audio/video) */
  cover?: string;
  /** Duration in seconds (for audio/video) */
  duration?: number;
  /** Title (for audio/video) */
  title?: string;
}

export interface AudioMetadata {
  item: string;
  type: string;
  cover?: string;
  duration?: number;
  title?: string;
  artist?: string;
}

// =====================================================================
// Types — Posts
// =====================================================================

export type PublicationType = "TEXT_ONLY" | "IMAGE" | "VIDEO" | "AUDIO" | "ARTICLE";

export interface CreatePostPayload {
  content: string;
  handle: string;
  locale: string;
  xAccessToken: string;
  items?: MediaItem[];
  audio?: AudioMetadata;
  publicationType?: PublicationType;
}

export interface CreatePostResult {
  ok: boolean;
  message: string;
  data?: unknown;
  txHash?: string;
}

export interface PostSlugResult {
  ok: boolean;
  message: string;
  slug: string | null;
}

export interface GetPostResult {
  ok: boolean;
  message: string;
  data?: { id: string; [key: string]: unknown };
}

// =====================================================================
// Types — Users
// =====================================================================

export interface OrbMedia {
  url: string;
  mimeType?: string;
}

export interface UserMetadata {
  name: string | null;
  handle: string | null;
  namespace: string | null;
  address: string;
  ownedBy: string;
  picture: OrbMedia | null;
  rawPicture: string | null;
}

export interface UserData {
  type: "USER";
  id: string;
  metadata: UserMetadata;
}

export interface GetUserResult {
  ok: boolean;
  message: string;
  data?: UserData;
}

// =====================================================================
// Types — Clubs (Groups)
// =====================================================================

export interface GroupMetadata {
  name: string | null;
  handle: string | null;
  namespace: string | null;
  address: string;
  picture: OrbMedia | null;
  rawPicture: string | null;
}

export interface GroupStats {
  totalMembers: number;
}
export interface GroupDetails {
  accessType: "PUBLIC" | "PRIVATE" | string;
}

export interface GroupData {
  type: "GROUP";
  id: string;
  metadata: GroupMetadata;
  stats?: GroupStats;
  details?: GroupDetails;
}

export interface ClubCategoryData {
  items: GroupData[];
  key: string;
  label: string;
  type: string;
}

export interface GetClubsResult {
  ok: boolean;
  message: string;
  data?: {
    items?: ClubCategoryData[];
    categories?: { key: string; label: string }[];
  };
}

// =====================================================================
// Types — Drafts
// =====================================================================

export interface DraftPostMetadataItem {
  id: string;
  uri: string;
  gatewayUrl: string;
  category: string;
  mimeType: string;
  audioDuration?: number | null;
  audioTitle?: string | null;
  audioCoverUri?: string | null;
  audioCoverGatewayUrl?: string | null;
  videoCoverUri?: string | null;
  videoCoverGatewayUrl?: string | null;
}

export interface DraftPostData {
  items: DraftPostMetadataItem[];
  content?: string | null;
}

export interface DraftPost {
  id: string;
  data: DraftPostData;
  updatedAt: number;
}

export interface DraftsResult {
  ok: boolean;
  message: string;
  data?: DraftPost[] | null;
}

// =====================================================================
// Types — Widgets
// =====================================================================

export interface WidgetPatch {
  id: string;
  imageUrl?: string | null;
  redirectUrl?: string | null;
  sourceId?: string | null;
  topLabel?: string | null;
  topLabelRedirectUrl?: string | null;
  context?: null;
  highlight?: boolean | null;
  buttonLabel?: string | null;
  counterLabel?: string | null;
  counterEnd?: number | null;
  customFeed?: { name: string; feedId: string } | null;
  active?: boolean;
  sortOrder?: number;
}

export interface WidgetData {
  id: string;
  imageUrl: string | null;
  redirectUrl: string | null;
  sourceId: string | null;
  topLabel: string | null;
  topLabelRedirectUrl: string | null;
  context: unknown[];
  buttonLabel: string | null;
  highlight: boolean;
  counterLabel: string | null;
  counterEnd: number | null;
  sortOrder: number;
  active: boolean;
  createdBy: string;
  customFeed: { name: string; feedId: string } | null;
}

export interface GetCustomWidgetsResult {
  ok: boolean;
  message: string;
  data?: WidgetData[];
}

export interface SetCustomWidgetsResult {
  ok: boolean;
  message: string;
}

// =====================================================================
// Types — Custom Feeds
// =====================================================================

export interface SetCustomFeedResult {
  ok: boolean;
  message: string;
}
export interface GetCustomFeedResult {
  ok: boolean;
  message: string;
  data?: { posts?: string[] };
}

// =====================================================================
// Types — Search
// =====================================================================

export interface SearchUserItem {
  id: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  relationship: string | null;
}

export interface SearchUsersResult {
  ok: boolean;
  message: string;
  data?: SearchUserItem[];
}

// =====================================================================
// Internal helpers
// =====================================================================

type AnyJson = Record<string, unknown>;

async function apiPost<T>(path: string, body: unknown, config?: OrbApiConfig): Promise<T> {
  const base = config?.apiBase ?? "";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(((json as AnyJson)?.message as string) ?? `Request failed (${res.status})`);
  return json as T;
}

function wrap<T extends { ok: boolean; message: string }>(
  fn: () => Promise<T>,
  fallbackMsg: string,
  errorDefaults?: Record<string, unknown>,
): Promise<T> {
  return fn().catch(
    (error) =>
      ({
        ...errorDefaults,
        ok: false,
        message: error instanceof Error ? error.message : fallbackMsg,
      }) as T,
  );
}

// =====================================================================
// Posts
// =====================================================================

/** Create a post transaction via the Orb backend. */
export function createPostTx(
  payload: CreatePostPayload,
  config?: OrbApiConfig,
): Promise<CreatePostResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/create-post", payload, config);
    return {
      ok: true,
      message: (json.message as string) ?? "Post transaction ready",
      data: json,
      txHash: json.txHash as string | undefined,
    };
  }, "Unable to create post");
}

/** Fetch the post slug for a published transaction hash (via Lens GraphQL). */
export function fetchPostSlug(txHash: string, config?: OrbApiConfig): Promise<PostSlugResult> {
  return wrap(
    async () => {
      const json = await apiPost<AnyJson>("/api/lens/post-by-tx", { txHash }, config);
      return {
        ok: true,
        message: (json.message as string) ?? "Slug fetched",
        slug: (json.slug as string) ?? null,
      };
    },
    "Unable to fetch post slug",
    { slug: null },
  );
}

/** Get a single post by ID. */
export function getPost(
  xAccessToken: string,
  postId: string,
  config?: OrbApiConfig,
): Promise<GetPostResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/get-post", { xAccessToken, postId }, config);
    return { ok: true, message: "Post found", data: json.data as GetPostResult["data"] };
  }, "Post not found");
}

// =====================================================================
// Users
// =====================================================================

/** Fetch user profile by Lens account address. */
export function getUser(
  address: string,
  xAccessToken: string,
  options?: { userAvatarThumbnailDimension?: number; mediaThumbnailDimension?: number },
  config?: OrbApiConfig,
): Promise<GetUserResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>(
      "/api/user",
      {
        address,
        xAccessToken,
        userAvatarThumbnailDimension: options?.userAvatarThumbnailDimension ?? 768,
        mediaThumbnailDimension: options?.mediaThumbnailDimension ?? 1180,
      },
      config,
    );
    return { ok: true, message: "User fetched", data: json.data as UserData };
  }, "Failed to get user");
}

// =====================================================================
// Clubs
// =====================================================================

/** Fetch clubs/groups for the authenticated user. */
export function getClubs(
  xAccessToken: string,
  options?: {
    category?: string;
    limit?: number;
    cursor?: string;
    userAvatarThumbnailDimension?: number;
    mediaThumbnailDimension?: number;
  },
  config?: OrbApiConfig,
): Promise<GetClubsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>(
      "/api/clubs",
      {
        xAccessToken,
        category: options?.category ?? "MY_CLUBS",
        limit: options?.limit ?? 5,
        cursor: options?.cursor,
        userAvatarThumbnailDimension: options?.userAvatarThumbnailDimension ?? 256,
        mediaThumbnailDimension: options?.mediaThumbnailDimension ?? 256,
      },
      config,
    );
    return { ok: true, message: "Clubs fetched", data: json.data as GetClubsResult["data"] };
  }, "Failed to get clubs");
}

// =====================================================================
// Search
// =====================================================================

/** Search Lens users by query string. */
export function searchUsers(
  query: string,
  xAccessToken: string,
  options?: { limit?: number },
  config?: OrbApiConfig,
): Promise<SearchUsersResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>(
      "/api/search",
      {
        query,
        xAccessToken,
        searchType: "USER",
        limit: options?.limit ?? 10,
      },
      config,
    );
    const items = (((json.data as AnyJson)?.items as AnyJson[]) ?? [])
      .filter((item) => (item as AnyJson).type === "USER")
      .map((item: AnyJson) => {
        const meta = item.metadata as AnyJson;
        const details = item.details as AnyJson | undefined;
        return {
          id: item.id as string,
          handle: (meta?.handle as string) ?? "",
          avatarUrl: (meta?.picture as string) ?? null,
          bio: (meta?.bio as string) ?? null,
          relationship: (details?.relationship as string) ?? null,
        };
      });
    return { ok: true, message: "Users found", data: items };
  }, "Search failed");
}

// =====================================================================
// Drafts
// =====================================================================

/** Get all drafts for the authenticated user. */
export function getDrafts(xAccessToken: string, config?: OrbApiConfig): Promise<DraftsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/drafts", { xAccessToken, task: "get" }, config);
    return { ok: true, message: "Drafts fetched", data: json.items as DraftPost[] };
  }, "Failed to get drafts");
}

/** Save or update a draft. */
export function setDraft(
  xAccessToken: string,
  id: string,
  data: DraftPostData,
  config?: OrbApiConfig,
): Promise<DraftsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>(
      "/api/drafts",
      { xAccessToken, task: "set", id, data },
      config,
    );
    return { ok: true, message: "Draft saved", data: json.data as DraftPost[] };
  }, "Failed to save draft");
}

/** Delete a draft by ID. */
export function removeDraft(
  xAccessToken: string,
  id: string,
  config?: OrbApiConfig,
): Promise<DraftsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>(
      "/api/drafts",
      { xAccessToken, task: "remove", id },
      config,
    );
    return { ok: true, message: "Draft removed", data: json.data as DraftPost[] };
  }, "Failed to remove draft");
}

// =====================================================================
// Widgets
// =====================================================================

/** Get all custom widgets for the authenticated user. */
export function getCustomWidgets(
  xAccessToken: string,
  config?: OrbApiConfig,
): Promise<GetCustomWidgetsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/widgets/get", { xAccessToken }, config);
    return {
      ok: true,
      message: "Widgets fetched",
      data: ((json.data as AnyJson)?.widgets ?? json.data) as WidgetData[],
    };
  }, "Failed to get widgets");
}

/** Create or update custom widgets. */
export function setCustomWidgets(
  xAccessToken: string,
  widgets: WidgetPatch[],
  config?: OrbApiConfig,
): Promise<SetCustomWidgetsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/widgets", { xAccessToken, widgets }, config);
    return { ok: true, message: (json.msg as string) ?? "Widgets saved" };
  }, "Failed to save widgets");
}

/** Delete widgets by ID. */
export function deleteCustomWidgets(
  xAccessToken: string,
  widgetIds: string[],
  config?: OrbApiConfig,
): Promise<SetCustomWidgetsResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>(
      "/api/widgets",
      { xAccessToken, task: "DELETE", widgets: widgetIds },
      config,
    );
    return { ok: true, message: (json.msg as string) ?? "Widgets deleted" };
  }, "Failed to delete widgets");
}

// =====================================================================
// Custom Feeds
// =====================================================================

/** Create or update a custom feed. */
export function setCustomFeed(
  xAccessToken: string,
  payload: {
    widgetId: string;
    name?: string;
    posts?: string[];
    widget?: Record<string, unknown>;
    widgetActive?: boolean;
  },
  config?: OrbApiConfig,
): Promise<SetCustomFeedResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/custom-feed", { xAccessToken, ...payload }, config);
    return { ok: true, message: (json.msg as string) ?? "Custom feed saved" };
  }, "Failed to save custom feed");
}

/** Get posts in a custom feed. Returns orb.club URLs. */
export function getCustomFeed(
  xAccessToken: string,
  feedId: string,
  config?: OrbApiConfig,
): Promise<GetCustomFeedResult> {
  return wrap(async () => {
    const json = await apiPost<AnyJson>("/api/custom-feed/get", { xAccessToken, feedId }, config);
    const items = ((json.data as AnyJson)?.items as AnyJson[]) || [];
    const posts = items
      .map((i) => (i as AnyJson).slug || ((i as AnyJson).metadata as AnyJson)?.slug)
      .filter(Boolean)
      .map((slug) => `https://orb.club/p/${slug}`);
    return { ok: true, message: "Custom feed fetched", data: { posts } };
  }, "Failed to get custom feed");
}

// =====================================================================
// Parallel fetch helpers
// =====================================================================

/**
 * Fetch user profile, clubs, and drafts in parallel.
 * Common pattern after login — runs 3 requests concurrently instead of sequentially.
 */
export function fetchUserData(
  address: string,
  xAccessToken: string,
  config?: OrbApiConfig,
): Promise<{ user: GetUserResult; clubs: GetClubsResult; drafts: DraftsResult }> {
  return Promise.all([
    getUser(address, xAccessToken, undefined, config),
    getClubs(xAccessToken, undefined, config),
    getDrafts(xAccessToken, config),
  ]).then(([user, clubs, drafts]) => ({ user, clubs, drafts }));
}

/**
 * Fetch user profile and clubs in parallel (without drafts).
 * Lighter variant for apps that don't need draft support.
 */
export function fetchUserAndClubs(
  address: string,
  xAccessToken: string,
  config?: OrbApiConfig,
): Promise<{ user: GetUserResult; clubs: GetClubsResult }> {
  return Promise.all([
    getUser(address, xAccessToken, undefined, config),
    getClubs(xAccessToken, undefined, config),
  ]).then(([user, clubs]) => ({ user, clubs }));
}

// =====================================================================
// Utilities
// =====================================================================

/** Extract a post ID from an orb.club URL or raw ID string. */
export function extractPostId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?orb\.club\/p\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}
