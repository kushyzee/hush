"use client";

import { useConversations } from "@/features/messaging/hooks/useConversations";
import { ChatWindow } from "@/features/messaging/components/ChatWindow";
import type { ConversationSummary } from "@/shared/types";

interface ConversationPageClientProps {
  userId: string;
}

export function ConversationPageClient({
  userId,
}: ConversationPageClientProps) {
  const { conversations } = useConversations();

  const partner: ConversationSummary = conversations.find(
    (c) => c.user_id === userId,
  ) ?? {
    user_id: userId,
    display_name: "",
    username: "",
    last_message_at: null,
  };

  return <ChatWindow partner={partner} />;
}
