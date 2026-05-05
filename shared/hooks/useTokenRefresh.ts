import { useEffect, useRef } from "react";
import { refreshAccessToken } from "@/features/auth/api";
import { setTokens } from "@/shared/lib/apiClient";

interface UseTokenRefreshOptions {
  expiresIn: number;
  refreshToken: string;
  onRefreshed: (newAccessToken: string) => void;
  onExpired: () => void;
}

export function useTokenRefresh({
  expiresIn,
  refreshToken,
  onRefreshed,
  onExpired,
}: UseTokenRefreshOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const delay = Math.max((expiresIn - 60) * 1000, 5_000);

    timerRef.current = setTimeout(async () => {
      try {
        const { access_token } = await refreshAccessToken({
          refresh_token: refreshToken,
        });
        setTokens(access_token, refreshToken);

        document.cookie = `access_token=${access_token}; path=/; SameSite=Lax`;
        onRefreshed(access_token);
      } catch {
        onExpired();
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [expiresIn, refreshToken, onRefreshed, onExpired]);
}
