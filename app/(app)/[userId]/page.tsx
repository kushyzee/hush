import { ConversationPageClient } from "@/features/messaging/components/ConversationPageClient";

interface ConversationPageProps {
  params: Promise<{ userId: string }>;
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { userId } = await params;

  return <ConversationPageClient userId={userId} />;
}
