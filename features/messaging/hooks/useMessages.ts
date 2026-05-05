import { useCallback, useEffect, useRef, useState } from "react";
import { getMessages } from "@/features/messaging/api";
import { decryptPayload } from "@/features/encryption/crypto";
import { getKey } from "@/features/encryption/keyStore";
import { ApiError } from "@/shared/lib/apiClient";
import type { MessageResponse, EncryptedPayload } from "@/shared/types";

export interface DecryptedMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  text: string | null;
  delivered: boolean;
  created_at: string;
  pending?: boolean;
}

export interface UseMessagesReturn {
  messages: DecryptedMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  appendMessage: (message: DecryptedMessage) => void;
  prependOptimistic: (
    text: string,
    fromUserId: string,
    toUserId: string,
  ) => string;
  confirmOptimistic: (
    tempId: string,
    confirmed: MessageResponse,
  ) => Promise<void>;
  failOptimistic: (tempId: string) => void;
}

const PAGE_SIZE = 50;

function tempId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function decryptOne(
  msg: MessageResponse,
  currentUserId: string,
  privateKey: CryptoKey,
): Promise<DecryptedMessage> {
  const isSender = msg.from_user_id === currentUserId;
  const text = await decryptPayload(
    msg.payload as EncryptedPayload,
    privateKey,
    isSender,
  );
  return {
    id: msg.id,
    from_user_id: msg.from_user_id,
    to_user_id: msg.to_user_id,
    text,
    delivered: msg.delivered,
    created_at: msg.created_at,
  };
}

async function decryptBatch(
  messages: MessageResponse[],
  currentUserId: string,
  privateKey: CryptoKey,
): Promise<DecryptedMessage[]> {
  return Promise.all(
    messages.map((msg) => decryptOne(msg, currentUserId, privateKey)),
  );
}

interface UseMessagesOptions {
  partnerId: string;
  currentUserId: string;
}

export function useMessages({
  partnerId,
  currentUserId,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePartnerId, setActivePartnerId] = useState(partnerId);

  if (partnerId !== activePartnerId) {
    setActivePartnerId(partnerId);
    setMessages([]);
    setIsLoading(true);
    setError(null);
    setHasMore(true);
  }

  const oldestTimestampRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    oldestTimestampRef.current = null;
    let cancelled = false;

    async function fetchInitial() {
      try {
        const privateKey = await getKey("privateKey");
        if (!privateKey) {
          setError("Encryption key not found. Please log in again.");
          return;
        }

        const raw = await getMessages(partnerId, { limit: PAGE_SIZE });

        if (cancelled) return;

        const decrypted = await decryptBatch(raw, currentUserId, privateKey);
        const oldestFirst = [...decrypted].reverse();

        setMessages(oldestFirst);
        setHasMore(raw.length === PAGE_SIZE);

        if (raw.length > 0) {
          oldestTimestampRef.current = raw[raw.length - 1].created_at;
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load messages.";
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [partnerId, currentUserId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const privateKey = await getKey("privateKey");
      if (!privateKey) return;

      const raw = await getMessages(partnerId, {
        limit: PAGE_SIZE,
        before: oldestTimestampRef.current ?? undefined,
      });

      const decrypted = await decryptBatch(raw, currentUserId, privateKey);
      const oldestFirst = [...decrypted].reverse();

      setMessages((prev) => [...oldestFirst, ...prev]);
      setHasMore(raw.length === PAGE_SIZE);

      if (raw.length > 0) {
        oldestTimestampRef.current = raw[raw.length - 1].created_at;
      }
    } catch {
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [partnerId, currentUserId, hasMore]);

  const appendMessage = useCallback((message: DecryptedMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const prependOptimistic = useCallback(
    (text: string, fromUserId: string, toUserId: string): string => {
      const id = tempId();
      const optimistic: DecryptedMessage = {
        id,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        text,
        delivered: false,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      return id;
    },
    [],
  );

  const confirmOptimistic = useCallback(
    async (id: string, confirmed: MessageResponse) => {
      const privateKey = await getKey("privateKey");
      if (!privateKey) return;

      const isSender = confirmed.from_user_id === currentUserId;
      const text = await decryptPayload(
        confirmed.payload as EncryptedPayload,
        privateKey,
        isSender,
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                id: confirmed.id,
                from_user_id: confirmed.from_user_id,
                to_user_id: confirmed.to_user_id,
                text,
                delivered: confirmed.delivered,
                created_at: confirmed.created_at,
                pending: false,
              }
            : m,
        ),
      );
    },
    [currentUserId],
  );

  const failOptimistic = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? ({ ...m, pending: false, failed: true } as DecryptedMessage & {
              failed: boolean;
            })
          : m,
      ),
    );
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    appendMessage,
    prependOptimistic,
    confirmOptimistic,
    failOptimistic,
  };
}
