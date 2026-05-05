import { apiClient } from "@/shared/lib/apiClient";
import type {
  ConversationSummary,
  MessageResponse,
  SendMessageRequest,
  EncryptedPayload,
} from "@/shared/types";

export async function getConversations(): Promise<ConversationSummary[]> {
  return apiClient.get<ConversationSummary[]>("/conversations");
}

export interface GetMessagesOptions {
  limit?: number;
  before?: string;
}

export async function getMessages(
  userId: string,
  options: GetMessagesOptions = {},
): Promise<MessageResponse[]> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.before) params.set("before", options.before);

  const query = params.size > 0 ? `?${params}` : "";
  return apiClient.get<MessageResponse[]>(
    `/conversations/${userId}/messages${query}`,
  );
}

export async function sendMessage(
  recipientId: string,
  payload: EncryptedPayload,
): Promise<MessageResponse> {
  const body: SendMessageRequest = { to: recipientId, payload };
  return apiClient.post<MessageResponse>("/messages", body);
}
