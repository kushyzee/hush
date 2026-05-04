export default async function ConversationPage({
  params,
}: {
  params: { userId: string };
}) {
  return <div>Conversation with {params.userId} — coming soon</div>;
}
