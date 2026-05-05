import { createContext, useContext } from "react";
import { UseWebSocketReturn } from "../hooks/useWebSocket";
import type { DecryptedMessage } from "../hooks/useMessages";

export const ChatContext = createContext<{
  sendMessage: UseWebSocketReturn["sendMessage"];
  onBack: () => void;
  setOnMessageReceived: (fn: ((msg: DecryptedMessage) => void) | null) => void;
} | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx)
    throw new Error("useChatContext must be inside ChatContextProvider");
  return ctx;
}
