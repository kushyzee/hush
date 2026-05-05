import { useCallback, useEffect, useState } from "react";
import { getConversations } from "@/features/messaging/api";
import { ApiError } from "@/shared/lib/apiClient";
import type { ConversationSummary } from "@/shared/types";

export interface UseConversationsReturn {
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  bumpConversation: (userId: string, lastMessageAt: string) => void;
  ensureConversation: (partner: ConversationSummary) => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getConversations();
        if (!cancelled) setConversations(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load conversations.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load conversations.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const bumpConversation = useCallback((userId: string, lastMessageAt: string) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.user_id === userId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], last_message_at: lastMessageAt };
      const rest = prev.filter((_, i) => i !== idx);
      return [updated, ...rest];
    });
  }, []);

  const ensureConversation = useCallback((partner: ConversationSummary) => {
    setConversations((prev) => {
      if (prev.some((c) => c.user_id === partner.user_id)) return prev;
      return [partner, ...prev];
    });
  }, []);

  return {
    conversations,
    isLoading,
    error,
    refetch,
    bumpConversation,
    ensureConversation,
  };
}
