import type { TokenResponse } from "@/shared/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
if (!BASE_URL)
  throw new Error("[apiClient] NEXT_PUBLIC_API_BASE_URL is not set...");

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken() {
  return accessToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseBody(
  res: Response,
): Promise<{ data: unknown; text: string }> {
  const text = await res.text(); // consume stream once
  if (!text) return { data: null, text: "" };
  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
}

function extractErrorMessage(
  status: number,
  statusText: string,
  data: unknown,
  text: string,
): string {
  const detail = (data as { detail?: string } | null)?.detail;
  if (detail?.trim()) return detail.trim();

  const msg = (data as { message?: string } | null)?.message;
  if (msg?.trim()) return msg.trim();

  if (text && text.length < 200 && !text.trim().startsWith("<"))
    return text.trim();

  return `Request failed with status ${status}${statusText ? ` (${statusText})` : ""}.`;
}

async function attemptRefresh(): Promise<string | null> {
  if (!refreshToken) return null;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data: TokenResponse = await res.json();
      accessToken = data.access_token;
      return data.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipAuth = false, headers: extraHeaders, ...rest } = options;

  const buildHeaders = (token: string | null): HeadersInit => ({
    "Content-Type": "application/json",
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders as Record<string, string> | undefined),
  });

  let res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders(accessToken),
  });

  if (res.status === 401 && !skipAuth) {
    const newToken = await attemptRefresh();

    if (!newToken) {
      throw new ApiError(401, "Session expired. Please log in again.");
    }

    // Retry original request with fresh token
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: buildHeaders(newToken),
    });
  }

  if (res.status === 204) return undefined as T;

  const { data, text } = await parseBody(res);

  if (!res.ok) {
    const message = extractErrorMessage(res.status, res.statusText, data, text);
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  publicPost<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      skipAuth: true,
    });
  },
};
