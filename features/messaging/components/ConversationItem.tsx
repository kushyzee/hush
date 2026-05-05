"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/shared/lib/utils";
import { UserAvatar } from "@/shared/components/UserAvatar";
import type { ConversationSummary } from "@/shared/types";

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const { display_name, username, last_message_at } = conversation;

  const timeAgo = last_message_at
    ? formatDistanceToNowStrict(new Date(last_message_at), { addSuffix: false })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left",
        "transition-colors duration-150 cursor-pointer group",
        "hover:bg-secondary",
        isActive && "bg-secondary",
      )}
    >
      <UserAvatar name={display_name || username} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isActive ? "text-foreground" : "text-foreground",
            )}
          >
            {display_name || username}
          </span>
          {timeAgo && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {timeAgo}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          @{username || "…"}
        </p>
      </div>

      {isActive && <div className="w-1 h-6 rounded-full bg-primary shrink-0" />}
    </button>
  );
}
