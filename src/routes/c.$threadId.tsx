import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/arevias/ChatView";

export const Route = createFileRoute("/c/$threadId")({
  component: ThreadRoute,
  head: () => ({ meta: [{ title: "Arevias — conversation" }] }),
});

function ThreadRoute() {
  const { threadId } = Route.useParams();
  // key remounts the whole chat (scroll refs, transient state) per thread so
  // nothing bleeds between conversations.
  return <ChatView key={threadId} threadId={threadId} />;
}
