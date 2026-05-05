"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildEncryptedPayload,
  decryptPayload,
} from "@/features/encryption/crypto";
import { getKey } from "@/features/encryption/keyStore";
import { sendMessage as restSendMessage } from "@/features/messaging/api";
import { getAccessToken } from "@/shared/lib/apiClient";
import type { DecryptedMessage } from "./useMessages";
import type {
  ConversationSummary,
  MessageResponse,
  EncryptedPayload,
} from "@/shared/types";

const WS_BASE = "wss://whisperbox.koyeb.app/ws";

const WS_CODE_TOKEN_EXPIRED = 4001;
const WS_CODE_TOKEN_INVALID = 4003;

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type PresenceMap = Record<string, "online" | "offline">;

export interface SendMessageOptions {
  recipientId: string;
  plaintext: string;
  recipientPublicKeyBase64: string;
  ownPublicKeyBase64: string;
}

export interface UseWebSocketOptions {
  currentUserId: string;
  onNeedRefresh: () => Promise<string | null>;
  onInvalidToken: () => Promise<void>;
  onMessageReceived: (message: DecryptedMessage) => void;
  onBumpConversation: (userId: string, lastMessageAt: string) => void;
  onEnsureConversation: (partner: ConversationSummary) => void;
}

export interface UseWebSocketReturn {
  status: ConnectionStatus;
  presence: PresenceMap;
  sendMessage: (options: SendMessageOptions) => Promise<MessageResponse | null>;
}

interface WsMessageReceive {
  event: "message.receive";
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: EncryptedPayload;
  created_at: string;
}

interface WsUserPresence {
  event: "user.online" | "user.offline";
  user_id: string;
}

interface WsError {
  event: "error";
  detail: string;
}

type WsInboundFrame = WsMessageReceive | WsUserPresence | WsError;

export function useWebSocket({
  currentUserId,
  onNeedRefresh,
  onInvalidToken,
  onMessageReceived,
  onBumpConversation,
  onEnsureConversation,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [presence, setPresence] = useState<PresenceMap>({});

  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  function clearBackoffTimer() {
    if (backoffTimerRef.current !== null) {
      clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = null;
    }
  }

  function computeBackoff(attempt: number): number {
    return Math.min(
      BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
      BACKOFF_MAX_MS,
    );
  }

  const handleMessageReceive = useCallback(
    async (frame: WsMessageReceive) => {
      const privateKey = await getKey("privateKey");
      if (!privateKey) return;

      const isSender = frame.from_user_id === currentUserId;
      const text = await decryptPayload(frame.payload, privateKey, isSender);

      const decrypted: DecryptedMessage = {
        id: frame.id,
        from_user_id: frame.from_user_id,
        to_user_id: frame.to_user_id,
        text,
        delivered: true,
        created_at: frame.created_at,
      };

      onMessageReceived(decrypted);

      const partnerId = isSender ? frame.to_user_id : frame.from_user_id;
      onBumpConversation(partnerId, frame.created_at);

      onEnsureConversation({
        user_id: partnerId,
        display_name: "",
        username: "",
        last_message_at: frame.created_at,
      });
    },
    [
      currentUserId,
      onMessageReceived,
      onBumpConversation,
      onEnsureConversation,
    ],
  );

  const connect = useCallback(() => {
    function start() {
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }

      const token = getAccessToken();
      if (!token) {
        setStatus("disconnected");
        return;
      }

      setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

      const ws = new WebSocket(`${WS_BASE}?token=${token}`);
      wsRef.current = ws;
      intentionalCloseRef.current = false;

      ws.onopen = () => {
        setStatus("connected");
        attemptRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let frame: WsInboundFrame;
        try {
          frame = JSON.parse(event.data) as WsInboundFrame;
        } catch {
          return;
        }

        switch (frame.event) {
          case "message.receive":
            void handleMessageReceive(frame);
            break;

          case "user.online":
            setPresence((prev) => ({ ...prev, [frame.user_id]: "online" }));
            break;

          case "user.offline":
            setPresence((prev) => ({ ...prev, [frame.user_id]: "offline" }));
            break;

          case "error":
            break;
        }
      };

      ws.onclose = async (event: CloseEvent) => {
        wsRef.current = null;

        if (intentionalCloseRef.current) return;

        if (event.code === WS_CODE_TOKEN_INVALID) {
          setStatus("disconnected");
          await onInvalidToken();
          return;
        }

        if (event.code === WS_CODE_TOKEN_EXPIRED) {
          setStatus("reconnecting");
          const newToken = await onNeedRefresh();
          if (newToken) {
            attemptRef.current = 0;
            start();
          } else {
            setStatus("disconnected");
            await onInvalidToken();
          }
          return;
        }

        setStatus("reconnecting");
        const delay = computeBackoff(attemptRef.current);
        attemptRef.current += 1;

        backoffTimerRef.current = setTimeout(() => {
          start();
        }, delay);
      };

      ws.onerror = () => {};
    }

    start();
  }, [handleMessageReceive, onNeedRefresh, onInvalidToken]);

  useEffect(() => {
    connect();

    return () => {
      clearBackoffTimer();
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback(
    async ({
      recipientId,
      plaintext,
      recipientPublicKeyBase64,
      ownPublicKeyBase64,
    }: SendMessageOptions): Promise<MessageResponse | null> => {
      const payload = await buildEncryptedPayload(
        plaintext,
        recipientPublicKeyBase64,
        ownPublicKeyBase64,
      );

      const ws = wsRef.current;

      if (ws && ws.readyState === WebSocket.OPEN) {
        const frame = {
          event: "message.send",
          to: recipientId,
          payload,
        };
        ws.send(JSON.stringify(frame));
        return null;
      }

      return restSendMessage(recipientId, payload);
    },
    [],
  );

  return { status, presence, sendMessage };
}
