"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  generateKeyPair,
  generateSalt,
  deriveWrappingKey,
  wrapPrivateKey,
  unwrapPrivateKey,
  importPublicKey,
} from "@/features/encryption/crypto";

import {
  storeKeyPair,
  clearKeys,
  hasKey,
} from "@/features/encryption/keyStore";

import {
  register as apiRegister,
  login as apiLogin,
  logout as apiLogout,
  getMe,
} from "@/features/auth/api";

import { setTokens, clearTokens, getAccessToken } from "@/shared/lib/apiClient";

import type { UserProfile } from "@/shared/types";

interface AuthContextValue {
  user: UserProfile | null;
  isReady: boolean;
  isAuthenticated: boolean;

  registerUser: (
    username: string,
    displayName: string,
    password: string,
  ) => Promise<void>;

  loginUser: (username: string, password: string) => Promise<void>;

  logoutUser: () => Promise<void>;

  refreshSession: (newAccessToken: string, newRefreshToken?: string) => void;
  refreshToken: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        let token = getAccessToken();
        let rToken = refreshToken;

        if (!token) {
          const match = document.cookie.match(/(?:^|; )access_token=([^;]+)/);
          if (match) token = match[1];
        }

        if (!rToken) {
          rToken = localStorage.getItem("refresh_token");
        }

        if (token && rToken) {
          setTokens(token, rToken);
          if (!cancelled) setRefreshToken(rToken);
        }

        const keyExists = await hasKey("privateKey");

        if (token && keyExists) {
          const profile = await getMe();
          if (!cancelled) setUser(profile);
        }
      } catch {
        clearTokens();
        document.cookie = "access_token=; path=/; max-age=0";
        localStorage.removeItem("refresh_token");
        if (!cancelled) setRefreshToken(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerUser = useCallback(
    async (username: string, displayName: string, password: string) => {
      const { privateKey, publicKey, publicKeyBase64 } =
        await generateKeyPair();

      const { saltBase64 } = generateSalt();

      const wrappingKey = await deriveWrappingKey(password, saltBase64);
      const wrappedPrivateKeyBase64 = await wrapPrivateKey(
        privateKey,
        wrappingKey,
      );

      const auth = await apiRegister({
        username,
        display_name: displayName,
        password,
        public_key: publicKeyBase64,
        wrapped_private_key: wrappedPrivateKeyBase64,
        pbkdf2_salt: saltBase64,
      });

      setTokens(auth.access_token, auth.refresh_token);

      document.cookie = `access_token=${auth.access_token}; path=/; SameSite=Lax`;

      localStorage.setItem("refresh_token", auth.refresh_token);
      setRefreshToken(auth.refresh_token);

      await storeKeyPair(privateKey, publicKey);

      setUser(auth.user);
    },
    [],
  );

  const loginUser = useCallback(async (username: string, password: string) => {
    const auth = await apiLogin({ username, password });
    console.log({ auth });

    setTokens(auth.access_token, auth.refresh_token);

    document.cookie = `access_token=${auth.access_token}; path=/; SameSite=Lax`;

    localStorage.setItem("refresh_token", auth.refresh_token);
    setRefreshToken(auth.refresh_token);
    const wrappingKey = await deriveWrappingKey(
      password,
      auth.user.pbkdf2_salt,
    );

    const privateKey = await unwrapPrivateKey(
      auth.user.wrapped_private_key,
      wrappingKey,
    );

    const publicKey = await importPublicKey(auth.user.public_key);

    await storeKeyPair(privateKey, publicKey);
    setUser(auth.user);
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      const rt = localStorage.getItem("refresh_token");
      if (rt) await apiLogout(rt);
    } catch {
    } finally {
      clearTokens();
      document.cookie = "access_token=; path=/; max-age=0";
      localStorage.removeItem("refresh_token");
      setRefreshToken(null);
      await clearKeys();
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback((newAccessToken: string, newRefreshToken?: string) => {
    const rt = newRefreshToken ?? localStorage.getItem("refresh_token") ?? "";
    setTokens(newAccessToken, rt);

    document.cookie = `access_token=${newAccessToken}; path=/; SameSite=Lax`;

    if (newRefreshToken) {
      localStorage.setItem("refresh_token", newRefreshToken);
      setRefreshToken(newRefreshToken);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isReady,
        isAuthenticated: user !== null,
        registerUser,
        loginUser,
        logoutUser,
        refreshSession,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used inside <AuthProvider>. " +
        "Wrap your app (or the protected layout) with <AuthProvider>.",
    );
  }
  return ctx;
}
