import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/arevias/ChatView";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

// `/` is the blank surface — no thread exists until the first message is sent.
function IndexComponent() {
  return <ChatView threadId={null} />;
}
