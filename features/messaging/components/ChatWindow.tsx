import { useEffect, useRef, useCallback, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { EncryptionBadge } from "@/shared/components/EncryptionBadge";
import { useMessages } from "@/features/messaging/hooks/useMessages";
import { getUserPublicKey } from "@/features/auth/api";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { ConversationSummary, MessageResponse } from "@/shared/types";
import { MessageInput } from "./MessageInput";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/shared/lib/utils";
import { useChatContext } from "../context/ChatContext";

interface ChatWindowProps {
  partner: ConversationSummary;
  onBack?: () => void;
}

export function ChatWindow({ partner, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const currentUserId = user!.id;

  const { sendMessage, setOnMessageReceived } = useChatContext();

  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    prependOptimistic,
    confirmOptimistic,
    failOptimistic,
    appendMessage,
  } = useMessages({ partnerId: partner.user_id, currentUserId });

  useEffect(() => {
    setOnMessageReceived(appendMessage);
    return () => setOnMessageReceived(null);
  }, [appendMessage, setOnMessageReceived]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (!isLoading) bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [isLoading]);

  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    const added = messages.length - prevCountRef.current;
    prevCountRef.current = messages.length;
    if (added > 0 && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;

    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    if (el.scrollTop < 80 && hasMore && !isLoadingMore) {
      const prevHeight = el.scrollHeight;
      loadMore().then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop +=
              scrollRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }

  const recipientKeyRef = useRef<string | null>(null);

  useEffect(() => {
    recipientKeyRef.current = null;
    getUserPublicKey(partner.user_id)
      .then(({ public_key }) => {
        recipientKeyRef.current = public_key;
      })
      .catch(() => {});
  }, [partner.user_id]);

  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(
    async (plaintext: string) => {
      if (!user) return;
      setIsSending(true);

      const tempId = prependOptimistic(
        plaintext,
        currentUserId,
        partner.user_id,
      );

      try {
        if (!recipientKeyRef.current) {
          const { public_key } = await getUserPublicKey(partner.user_id);
          recipientKeyRef.current = public_key;
        }

        const confirmed: MessageResponse | null = await sendMessage({
          recipientId: partner.user_id,
          plaintext,
          recipientPublicKeyBase64: recipientKeyRef.current,
          ownPublicKeyBase64: user.public_key,
        });

        if (confirmed) await confirmOptimistic(tempId, confirmed);
      } catch (err) {
        failOptimistic(tempId);
        toast.error(err instanceof Error ? err.message : "Failed to send.");
      } finally {
        setIsSending(false);
      }
    },
    [
      user,
      partner.user_id,
      sendMessage,
      currentUserId,
      prependOptimistic,
      confirmOptimistic,
      failOptimistic,
    ],
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        {onBack && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary lg:hidden"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </Button>
        )}

        <UserAvatar name={partner.display_name || partner.username} size="md" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {partner.display_name}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            @{partner.username}
          </p>
        </div>

        <EncryptionBadge />
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-1.5",
          "[scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]",
        )}
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 size={16} className="text-muted-foreground animate-spin" />
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  i % 2 === 0 ? "justify-start" : "justify-end",
                )}
              >
                <Skeleton
                  className={cn(
                    "h-9 rounded-2xl",
                    i % 2 === 0 ? "w-48" : "w-32",
                  )}
                />
              </div>
            ))}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSent={msg.from_user_id === currentUserId}
            />
          ))
        )}

        <div ref={bottomRef} className="shrink-0 h-px" />
      </div>

      {/* Composer */}
      <MessageInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}
