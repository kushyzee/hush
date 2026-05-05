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

export async function register(
  payload: RegisterRequest,
): Promise<AuthResponse> {
  return apiClient.publicPost<AuthResponse>("/auth/register", payload);
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  return apiClient.publicPost<AuthResponse>("/auth/login", payload);
}

export async function getMe(): Promise<UserProfile> {
  return apiClient.get<UserProfile>("/auth/me");
}

export async function refreshAccessToken(
  payload: RefreshRequest,
): Promise<TokenResponse> {
  return apiClient.publicPost<TokenResponse>("/auth/refresh", payload);
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post<unknown>("/auth/logout", {
    refresh_token: refreshToken,
  } satisfies RefreshRequest);
}

export async function searchUsers(query: string): Promise<UserPublicInfo[]> {
  const params = new URLSearchParams({ q: query });
  return apiClient.get<UserPublicInfo[]>(`/users/search?${params}`);
}

export async function getUserPublicKey(userId: string): Promise<UserPublicKey> {
  return apiClient.get<UserPublicKey>(`/users/${userId}/public-key`);
}
