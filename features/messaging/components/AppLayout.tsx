"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useConversations } from "@/features/messaging/hooks/useConversations";
import { useWebSocket } from "@/features/messaging/hooks/useWebSocket";
import { Sidebar } from "@/features/messaging/components/Sidebar";
import { NewChatModal } from "@/features/messaging/components/NewChatModal";
import type { DecryptedMessage } from "@/features/messaging/hooks/useMessages";
import { useTokenRefresh } from "@/shared/hooks/useTokenRefresh";
import { ChatContext } from "../context/ChatContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady, isAuthenticated, logoutUser, refreshSession } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, router]);

  const {
    conversations,
    isLoading: convosLoading,
    error: convosError,
    bumpConversation,
    ensureConversation,
  } = useConversations();

  const activeUserId = pathname.startsWith("/chat/")
    ? (pathname.split("/chat/")[1] ?? null)
    : null;

  const showChat = !!activeUserId;

  function handleSelectConversation(userId: string) {
    router.push(`/chat/${userId}`);
  }

  function handleBack() {
    router.push("/chat");
  }

  const [newChatOpen, setNewChatOpen] = useState(false);

  useTokenRefresh({
    expiresIn: 900,

    refreshToken: "",
    onRefreshed: (newToken) => refreshSession(newToken),
    onExpired: logoutUser,
  });

  const onMessageReceivedRef = useRef<((msg: DecryptedMessage) => void) | null>(
    null,
  );
  const handleMessageReceived = useCallback((msg: DecryptedMessage) => {
    onMessageReceivedRef.current?.(msg);
  }, []);

  const setOnMessageReceived = useCallback(
    (fn: ((msg: DecryptedMessage) => void) | null) => {
      onMessageReceivedRef.current = fn;
    },
    [],
  );

  const { status: wsStatus, sendMessage } = useWebSocket({
    currentUserId: user?.id ?? "",
    onNeedRefresh: async () => {
      try {
        const rt = ""; // ← wire up from AuthContext
        const { access_token } = await import("@/features/auth/api").then((m) =>
          m.refreshAccessToken({ refresh_token: rt }),
        );
        refreshSession(access_token);
        return access_token;
      } catch {
        return null;
      }
    },
    onInvalidToken: logoutUser,
    onMessageReceived: handleMessageReceived,
    onBumpConversation: bumpConversation,
    onEnsureConversation: ensureConversation,
  });

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 rounded-lg bg-primary flex items-center justify-center
                          animate-pulse"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-primary-foreground"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null; // redirect in-flight

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar — hidden on mobile when a chat is open */}
        <div
          className={[
            "lg:flex lg:flex-col lg:w-80 lg:shrink-0",
            showChat ? "hidden" : "flex flex-col w-full",
          ].join(" ")}
        >
          <Sidebar
            conversations={conversations}
            isLoading={convosLoading}
            error={convosError}
            activeUserId={activeUserId}
            connectionStatus={wsStatus}
            onSelectConversation={handleSelectConversation}
            onNewChat={() => setNewChatOpen(true)}
          />
        </div>

        <ChatContext.Provider
          value={{ sendMessage, onBack: handleBack, setOnMessageReceived }}
        >
          <main
            className={[
              "flex-1 flex flex-col min-w-0",
              showChat ? "flex" : "hidden lg:flex",
            ].join(" ")}
          >
            {activeUserId ? children : <EmptyState />}
          </main>
        </ChatContext.Provider>
      </div>

      <NewChatModal
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        ensureConversation={ensureConversation}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4
                    bg-background text-center px-8"
    >
      <div
        className="size-14 rounded-2xl bg-card border border-border
                      flex items-center justify-center"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Select a conversation
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Choose from your existing conversations or start a new one. Messages
          are end-to-end encrypted.
        </p>
      </div>
    </div>
  );
}
