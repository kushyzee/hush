import { MessageCircle } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { UseConversationsReturn } from "@/features/messaging/hooks/useConversations";
import { ConversationItem } from "./ConversationItem";

interface ConversationListProps {
  conversations: UseConversationsReturn["conversations"];
  isLoading: UseConversationsReturn["isLoading"];
  error: UseConversationsReturn["error"];
  activeUserId: string | null;
  onSelect: (userId: string) => void;
}

export function ConversationList({
  conversations,
  isLoading,
  error,
  activeUserId,
  onSelect,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 px-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="px-5 py-4 text-xs text-destructive">{error}</p>;
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center">
          <MessageCircle size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          No conversations yet.
          <br />
          Start one with the button above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {conversations.map((convo) => (
        <ConversationItem
          key={convo.user_id}
          conversation={convo}
          isActive={convo.user_id === activeUserId}
          onClick={() => onSelect(convo.user_id)}
        />
      ))}
    </div>
  );
}
