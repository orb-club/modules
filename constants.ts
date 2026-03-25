// Protocol gateways
export const IPFS_GATEWAY = "gw.ipfs-lens.dev/ipfs/";
export const ARWEAVE_GATEWAY = "arweave.net/";
export const LENS_GATEWAY = "api.grove.storage/";

// Public APIs
export const LENS_API_URL = "https://api.lens.xyz/graphql";

// Lens chain
export const LENS_CHAIN_ID = 232;

// Media defaults
export const DEFAULT_THUMBNAIL_DIMENSION = 768;

// Grove upload defaults
export const GROVE_PROPAGATION_TIMEOUT_MS = 5_000;
export const GROVE_POLL_INTERVAL_MS = 500;

// Lens GraphQL queries
export const REFRESH_MUTATION = `
  mutation Refresh($request: RefreshRequest!) {
    refresh(request: $request) {
      ... on AuthenticationTokens {
        __typename
        accessToken
        refreshToken
        idToken
      }
      ... on ForbiddenError {
        __typename
        reason
      }
    }
  }
`;

export const REVOKE_MUTATION = `
  mutation RevokeAuthentication($request: RevokeAuthenticationRequest!) {
    revokeAuthentication(request: $request)
  }
`;

export const POST_BY_TX_QUERY = `query PostByTx($txHash: TxHash!) { post(request: { txHash: $txHash }) { ... on Post { slug } } }`;

// Auth defaults
export const DEFAULT_STORAGE_KEY = "app_auth";
export const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_REFRESH_INTERVAL_MS = 10_000;
export const DEFAULT_REFRESH_BUFFER_S = 60;
export const DEFAULT_POLL_INTERVAL_MS = 2_000;
