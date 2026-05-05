import { useRouter } from "next/navigation";
import { LogOut, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { UseConversationsReturn } from "@/features/messaging/hooks/useConversations";
import type { ConnectionStatus } from "@/features/messaging/hooks/useWebSocket";
import { ConversationList } from "./ConversationList";

interface SidebarProps {
  conversations: UseConversationsReturn["conversations"];
  isLoading: UseConversationsReturn["isLoading"];
  error: UseConversationsReturn["error"];
  activeUserId: string | null;
  connectionStatus: ConnectionStatus;
  onSelectConversation: (userId: string) => void;
  onNewChat: () => void;
}

export function Sidebar({
  conversations,
  isLoading,
  error,
  activeUserId,
  connectionStatus,
  onSelectConversation,
  onNewChat,
}: SidebarProps) {
  const { user, logoutUser } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    try {
      await logoutUser();
      router.push("/login");
    } catch {
      toast.error("Logout failed. Please try again.");
    }
  }

  const isReconnecting =
    connectionStatus === "reconnecting" || connectionStatus === "connecting";

  return (
    <aside className="flex flex-col h-full w-80 bg-card border-r border-border shrink-0">
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
            <Lock size={13} className="text-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Hush
          </span>
        </div>

        {/* New chat button */}
        <Tooltip>
          <TooltipTrigger>
            <Button
              size="icon"
              variant="ghost"
              onClick={onNewChat}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              aria-label="New conversation"
            >
              <Plus size={17} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New conversation</TooltipContent>
        </Tooltip>
      </div>

      {isReconnecting && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-warning animate-pulse shrink-0" />
          <p className="text-[11px] text-warning font-medium">Reconnecting…</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 py-1 [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]">
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          error={error}
          activeUserId={activeUserId}
          onSelect={onSelectConversation}
        />
      </div>

      <div className="border-t border-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-secondary transition-colors duration-150 group">
            <UserAvatar
              name={user?.display_name ?? user?.username ?? "?"}
              size="sm"
            />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {user?.display_name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                @{user?.username}
              </p>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            className="w-52 bg-popover border-border"
          >
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.display_name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                @{user?.username}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
            >
              <LogOut size={14} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
