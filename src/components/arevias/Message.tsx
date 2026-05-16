import { motion } from "framer-motion";
import { RepliedIcon, ReplyIcon } from "./ReplyGlyph";

export type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Hide role label when chained from same role. */
  continuation?: boolean;
  /** Reference to the message this one is replying to. */
  replyTo?: { id: string; role: "user" | "ai"; text: string };
};

export function MessageBlock({
  msg,
  onReply,
}: {
  msg: Message;
  onReply?: (msg: Message) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
      className={`arevias-message-row group w-full flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`arevias-message-bubble max-w-[78%] ${
          isUser ? "text-right" : "text-left"
        } relative`}
      >
        {!msg.continuation && (
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            {isUser ? "you" : "arevias"}
          </div>
        )}

        {msg.replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`mb-2 flex items-start gap-2 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex items-center gap-2 max-w-full ${
                isUser ? "flex-row-reverse text-right" : "text-left"
              }`}
            >
              <RepliedIcon className="text-foreground/35 shrink-0" size={13} />
              <div className="font-mono text-[11px] leading-none tracking-wide text-foreground/35">
                <span className="mr-1.5 opacity-60">
                  {msg.replyTo.role === "user" ? "you" : "arevias"}
                </span>
                <span className="italic">{truncate(msg.replyTo.text)}</span>
              </div>
            </div>
          </motion.div>
        )}

        <div className="relative inline-block">
          <p
            className={`${
              isUser
                ? "text-foreground text-lg md:text-xl font-light leading-snug"
                : "text-foreground/90 text-xl md:text-2xl font-light leading-relaxed"
            } whitespace-pre-wrap`}
          >
            {msg.text}
          </p>

          {onReply && (
            <button
              type="button"
              onClick={() => onReply(msg)}
              aria-label="Reply"
              className={`arevias-reply-button absolute top-1/2 -translate-y-1/2 ${
                isUser ? "-left-9" : "-right-9"
              } opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity duration-300 h-7 w-7 rounded-full flex items-center justify-center text-foreground/70`}
            >
              <ReplyIcon size={13} strokeWidth={1.4} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function truncate(s: string, n = 80) {
  return s.length > n ? `${s.slice(0, n).trim()}…` : s;
}
