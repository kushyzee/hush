"use client";

import { CheckCheck, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { DecryptedMessage } from "@/features/messaging/hooks/useMessages";

interface MessageBubbleProps {
  message: DecryptedMessage & { failed?: boolean };
  isSent: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  const { text, delivered, created_at, pending, failed } = message;

  return (
    <div
      className={cn("flex w-full", isSent ? "justify-end" : "justify-start")}
    >
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              "relative max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm",
              "shadow-sm select-text wrap-break-word",
              isSent && ["bg-[--bubble-sent] text-foreground", "rounded-br-md"],
              !isSent && [
                "bg-[--bubble-received] text-foreground border border-border",
                "rounded-bl-md",
              ],
              pending && "opacity-60",
              failed && "opacity-40 ring-1 ring-destructive",
            )}
          >
            {text !== null ? (
              <p className="leading-relaxed whitespace-pre-wrap">{text}</p>
            ) : (
              <p className="italic text-muted-foreground text-xs">
                [Unable to decrypt message]
              </p>
            )}

            <div
              className={cn(
                "flex items-center gap-1 mt-1",
                isSent ? "justify-end" : "justify-start",
              )}
            >
              <span className="text-[10px] text-muted-foreground leading-none">
                {formatTime(created_at)}
              </span>

              {isSent && (
                <span className="leading-none">
                  {pending ? (
                    <Check size={11} className="text-muted-foreground" />
                  ) : delivered ? (
                    <CheckCheck size={11} className="text-success" />
                  ) : (
                    <CheckCheck size={11} className="text-muted-foreground" />
                  )}
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>

        <TooltipContent side={isSent ? "left" : "right"} className="text-xs">
          {new Date(created_at).toLocaleString()}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
