import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { searchUsers } from "@/features/auth/api";
import type { UserPublicInfo, ConversationSummary } from "@/shared/types";
import type { UseConversationsReturn } from "@/features/messaging/hooks/useConversations";
import { cn } from "@/shared/lib/utils";

interface NewChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ensureConversation: UseConversationsReturn["ensureConversation"];
}

type SearchState = "idle" | "loading" | "done" | "error";

export function NewChatModal({
  open,
  onOpenChange,
  ensureConversation,
}: NewChatModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublicInfo[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setQuery("");
        setResults([]);
        setSearchState("idle");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearchState("loading");
      try {
        const data = await searchUsers(trimmed);
        setResults(data);
        setSearchState("done");
      } catch {
        setSearchState("error");
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = useCallback(
    (user: UserPublicInfo) => {
      const partner: ConversationSummary = {
        user_id: user.id,
        display_name: user.display_name,
        username: user.username,
        last_message_at: null,
      };

      ensureConversation(partner);
      onOpenChange(false);
      router.push(`/chat/${user.id}`);
    },
    [ensureConversation, onOpenChange, router],
  );

  const showEmpty =
    searchState === "done" && results.length === 0 && query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-popover border-border max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-sm font-semibold text-foreground">
            New conversation
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          {searchState === "loading" ? (
            <Loader2
              size={15}
              className="text-muted-foreground shrink-0 animate-spin"
            />
          ) : (
            <Search size={15} className="text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              if (!value.trim()) {
                setResults([]);
                setSearchState("idle");
              }
            }}
            placeholder="Search by name or username…"
            className={cn(
              "flex-1 bg-transparent text-sm text-foreground",
              "placeholder:text-muted-foreground",
              "focus:outline-none",
            )}
          />
        </div>

        <div className="overflow-y-auto max-h-72 py-1.5 [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]">
          {searchState === "idle" && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <UserRound size={22} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Start typing to find someone
              </p>
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-xs text-muted-foreground">
                No users found for{" "}
                <span className="text-foreground font-medium">
                  &quot;{query}&quot;
                </span>
              </p>
            </div>
          )}

          {searchState === "error" && (
            <p className="text-xs text-destructive text-center py-6">
              Search failed. Please try again.
            </p>
          )}

          {/* User rows */}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                "hover:bg-secondary transition-colors duration-100 cursor-pointer",
              )}
            >
              <UserAvatar name={user.display_name || user.username} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {user.display_name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  @{user.username}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
