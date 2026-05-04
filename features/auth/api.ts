/**
 * features/auth/api.ts
 * --------------------
 * Pure API call functions for auth and user endpoints.
 *
 * Design principles:
 *   - Every function is async, returns a typed value, and throws on error.
 *   - No React, no hooks, no side effects — just fetch wrappers.
 *   - The `apiClient` (shared/lib/apiClient.ts) handles:
 *       • attaching the Authorization header from module-level token state
 *       • silent token refresh on 401 (one concurrent refresh via refreshPromise)
 *       • throwing ApiError with status + message on non-2xx
 *   - Tokens are managed via setTokens() / clearTokens() — NOT passed per-call.
 *     Call setTokens(access, refresh) after login/register before any auth'd call.
 *   - Public endpoints (no Bearer token needed) use apiClient.publicPost() or
 *     apiClient.get() with skipAuth: true.
 *
 * Covered endpoints:
 *   POST /auth/register
 *   POST /auth/login
 *   GET  /auth/me
 *   POST /auth/refresh
 *   POST /auth/logout
 *   GET  /users/search?q=
 *   GET  /users/{userId}/public-key
 *
 * Messaging endpoints live in features/messaging/api.ts.
 */

import { apiClient } from "@/shared/lib/apiClient";
import type {
  AuthResponse,
  TokenResponse,
  UserProfile,
  UserPublicInfo,
  UserPublicKey,
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
} from "@/shared/types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Register a new user account.
 *
 * PUBLIC — no Bearer token needed.
 *
 * The caller (useAuth) is responsible for generating all key material
 * client-side via crypto.ts BEFORE calling this. This function simply POSTs
 * the pre-assembled payload.
 *
 * After a successful response, call setTokens(auth.access_token, auth.refresh_token)
 * so subsequent apiClient calls attach the Authorization header automatically.
 *
 * @param payload — fully assembled RegisterRequest (username, display_name,
 *                  password, public_key, wrapped_private_key, pbkdf2_salt)
 * @returns AuthResponse — access_token, refresh_token, expires_in, user profile
 *
 * @throws ApiError 409 — username already taken
 * @throws ApiError 422 — server-side validation failed
 *
 * @example
 * ```ts
 * const auth = await register({ username, display_name, password, public_key, ... });
 * setTokens(auth.access_token, auth.refresh_token);
 * await storeKeyPair(privateKey, publicKey);
 * ```
 */
export async function register(
  payload: RegisterRequest,
): Promise<AuthResponse> {
  return apiClient.publicPost<AuthResponse>("/auth/register", payload);
}

/**
 * Log in with username and password.
 *
 * PUBLIC — no Bearer token needed.
 *
 * The response includes wrapped_private_key and pbkdf2_salt inside auth.user.
 * The caller (useAuth) must use these to re-derive the wrapping key and unwrap
 * the RSA private key back into a CryptoKey via crypto.ts.
 *
 * After a successful response, call setTokens(auth.access_token, auth.refresh_token).
 *
 * @param payload — { username, password }
 * @returns AuthResponse — same shape as register()
 *
 * @throws ApiError 401 — wrong username or password
 *
 * @example
 * ```ts
 * const auth = await login({ username, password });
 * setTokens(auth.access_token, auth.refresh_token);
 * const privateKey = await unwrapPrivateKey(
 *   auth.user.wrapped_private_key,
 *   password,
 *   auth.user.pbkdf2_salt,
 * );
 * ```
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  return apiClient.publicPost<AuthResponse>("/auth/login", payload);
}

/**
 * Get the current user's full profile, including key material.
 *
 * PROTECTED — requires a valid access token to have been set via setTokens().
 *
 * This is the only endpoint (besides login/register) that returns
 * wrapped_private_key. Call it on app reload when IndexedDB has been cleared
 * but the user still has a valid session (e.g. they refreshed the page).
 *
 * @returns UserProfile — id, username, display_name, public_key,
 *                        wrapped_private_key, pbkdf2_salt, created_at
 *
 * @throws ApiError 401 — token missing or expired (apiClient will attempt
 *                        one silent refresh before throwing)
 */
export async function getMe(): Promise<UserProfile> {
  return apiClient.get<UserProfile>("/auth/me");
}

/**
 * Exchange a refresh token for a new access token.
 *
 * PUBLIC — no Bearer token needed.
 *
 * NOTE: In practice, apiClient handles silent refresh internally via
 * attemptRefresh(). You only need to call this directly if you want to
 * proactively refresh before the token expires (e.g. in useTokenRefresh at
 * the 14-minute mark). Do NOT call this in response to a 401 — apiClient
 * already does that automatically.
 *
 * The refresh token is NOT rotated — the same refresh token is valid until
 * it expires or is revoked via logout().
 *
 * After a successful call, update the module-level token:
 *   setTokens(newAccessToken, existingRefreshToken)
 *
 * @param payload — { refresh_token }
 * @returns TokenResponse — { access_token, token_type, expires_in }
 *
 * @throws ApiError 401 — refresh token expired or revoked
 *                        → treat as full session end, redirect to login
 *
 * @example
 * ```ts
 * // In useTokenRefresh (proactive refresh ~1 min before expiry):
 * try {
 *   const { access_token } = await refreshAccessToken({ refresh_token });
 *   setTokens(access_token, refresh_token); // keep same refresh token
 * } catch (err) {
 *   if (err instanceof ApiError && err.status === 401) {
 *     await logoutUser(); // both tokens dead
 *   }
 * }
 * ```
 */
export async function refreshAccessToken(
  payload: RefreshRequest,
): Promise<TokenResponse> {
  return apiClient.publicPost<TokenResponse>("/auth/refresh", payload);
}

/**
 * Revoke the refresh token and end the session on the server.
 *
 * PROTECTED — requires a valid access token (set via setTokens()).
 *
 * After this call the refresh token is permanently dead. The access token
 * expires naturally after ~15 min but should be cleared from memory immediately.
 *
 * IMPORTANT: Always clear local state in a `finally` block — never depend on
 * this call succeeding before cleaning up. If the server is unreachable the
 * user should still be logged out locally.
 *
 * @param refreshToken — the refresh token string to revoke
 *
 * @throws ApiError 401 — access token already expired. Safe to ignore in a
 *                        finally block since we're logging out anyway.
 *
 * @example
 * ```ts
 * // In useAuth logout():
 * try {
 *   await logout(storedRefreshToken);
 * } catch {
 *   // best-effort — always clean up regardless
 * } finally {
 *   clearTokens();
 *   await clearKeys();
 *   setUser(null);
 *   router.push("/login");
 * }
 * ```
 */
export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post<unknown>("/auth/logout", {
    refresh_token: refreshToken,
  } satisfies RefreshRequest);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Search for users by username or display name.
 *
 * PROTECTED — requires access token set via setTokens().
 *
 * - Case-insensitive, partial match.
 * - The authenticated user is excluded from results automatically.
 * - Returns at most 20 results.
 * - Returns [] if no users match — never throws on empty results.
 *
 * @param query — search string (1–64 chars)
 * @returns UserPublicInfo[] — [{ id, username, display_name }]
 *
 * @throws ApiError 422 — query is empty or exceeds 64 chars
 *
 * @example
 * ```ts
 * const results = await searchUsers("bob");
 * // [{ id: "uuid", username: "bob_99", display_name: "Bob" }]
 * ```
 */
export async function searchUsers(query: string): Promise<UserPublicInfo[]> {
  const params = new URLSearchParams({ q: query });
  return apiClient.get<UserPublicInfo[]>(`/users/search?${params}`);
}

/**
 * Fetch the RSA-OAEP public key for a specific user.
 *
 * PROTECTED — requires access token set via setTokens().
 *
 * Call this before encrypting the per-message AES key for a recipient.
 * The returned base64 string must be imported via importPublicKey() from
 * crypto.ts before use with SubtleCrypto.
 *
 * Tip: cache the imported CryptoKey in a Map<userId, CryptoKey> for the
 * session to avoid re-fetching and re-importing on every message send.
 *
 * @param userId — UUID of the user whose public key you need
 * @returns UserPublicKey — { public_key: base64 string }
 *
 * @throws ApiError 404 — user not found
 *
 * @example
 * ```ts
 * const { public_key } = await getUserPublicKey(recipientId);
 * const recipientKey = await importPublicKey(public_key);
 * // use recipientKey to encrypt the AES message key
 * ```
 */
export async function getUserPublicKey(userId: string): Promise<UserPublicKey> {
  return apiClient.get<UserPublicKey>(`/users/${userId}/public-key`);
}
