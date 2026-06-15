import { useEffect, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  usePresence,
} from "framer-motion";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { MenuToggle } from "@/components/ui/menu-toggle";
import { deleteThread, useThreads, type Thread } from "@/lib/conversations";

const EASE = [0.22, 1, 0.36, 1] as const;
// Standard fade curve for the opacity/backdrop crossfades (paired with the
// slower --reveal mask wipe, which uses EASE).
const FADE_EASE = [0.4, 0, 0.2, 1] as [number, number, number, number];

// Inner content materializes with a brief stagger, delayed until the mask wipe
// has uncovered most of the panel.
const innerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.22 } },
};
const innerItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: FADE_EASE } },
};

/* ── Hand-rolled stroke icons (match the ReplyGlyph stroke language) ─────── */

function PlusIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 2.5v9" />
      <path d="M2.5 7h9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3.5h9" />
      <path d="M5 3.5V2.4a.9.9 0 0 1 .9-.9h1.2a.9.9 0 0 1 .9.9v1.1" />
      <path d="M3.2 3.5l.5 7a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.5-7" />
      <path d="M5.4 5.8v3.4" />
      <path d="M7.6 5.8v3.4" />
    </svg>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* ── Thread row ──────────────────────────────────────────────────────────── */

function ThreadRow({
  thread,
  active,
  onOpen,
  onDelete,
}: {
  thread: Thread;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer outline-none"
      style={{
        background: active
          ? "color-mix(in oklab, var(--color-foreground) 6%, transparent)"
          : hovered
            ? "color-mix(in oklab, var(--color-foreground) 3%, transparent)"
            : "transparent",
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] truncate"
          style={{
            color: active
              ? "var(--color-foreground)"
              : "color-mix(in oklab, var(--color-foreground) 75%, transparent)",
          }}
        >
          {thread.title}
        </div>
        <div
          className="font-sans text-[10px] mt-0.5 tracking-wide"
          style={{ color: "color-mix(in oklab, var(--color-foreground) 32%, transparent)" }}
        >
          {formatWhen(thread.updatedAt)}
        </div>
      </div>
      <button
        type="button"
        aria-label={`Delete "${thread.title}"`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ color: "var(--color-foreground)" }}
      >
        <span className="opacity-50">
          <TrashIcon />
        </span>
      </button>
    </div>
  );
}

/* ── Panel surface ───────────────────────────────────────────────────────── */

// Feathered left→right mask wipe. A ~22%-wide alpha feather always leads the
// reveal, so the panel never presents a hard moving edge that could read as a
// black bar over the composer. Enter and exit run the same sweep (reversed),
// so close mirrors open exactly — no slide, no blur.
//
// `--reveal` (0→100) is driven through a MotionValue + useMotionTemplate rather
// than animated as a bare CSS custom property via framer's keyframes: framer
// can't reliably interpolate an unregistered custom property across remounts —
// it snaps to the target and aborts the whole batch (opacity included). The
// imperative MotionValue path is rock-solid. usePresence keeps the element
// mounted until the exit sweep finishes (safeToRemove on the longer tween).
function PanelSurface({
  threads,
  activeId,
  navigate,
  setOpen,
}: {
  threads: Thread[];
  activeId: string | null;
  navigate: ReturnType<typeof useNavigate>;
  setOpen: (open: boolean) => void;
}) {
  const [isPresent, safeToRemove] = usePresence();
  const reveal = useMotionValue(0);
  const opacity = useMotionValue(0);
  const maskImage = useMotionTemplate`linear-gradient(90deg, #000 0%, #000 calc(${reveal}% - 22%), rgba(0,0,0,0) ${reveal}%)`;

  useEffect(() => {
    if (isPresent) {
      const r = animate(reveal, 100, { duration: 0.7, ease: EASE });
      const o = animate(opacity, 1, { duration: 0.45, ease: FADE_EASE });
      return () => {
        r.stop();
        o.stop();
      };
    }
    // Exit: reverse the sweep; safeToRemove fires when the longer (reveal)
    // tween completes so AnimatePresence holds us for the full wipe.
    const r = animate(reveal, 0, { duration: 0.7, ease: EASE, onComplete: safeToRemove });
    const o = animate(opacity, 0, { duration: 0.45, ease: FADE_EASE });
    return () => {
      r.stop();
      o.stop();
    };
  }, [isPresent, reveal, opacity, safeToRemove]);

  return (
    <motion.aside
      style={{
        opacity,
        WebkitMaskImage: maskImage,
        maskImage,
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--color-background) 96%, transparent) 0%, color-mix(in oklab, var(--color-background) 92%, transparent) 100%)",
        boxShadow:
          "1px 0 40px color-mix(in oklab, var(--color-foreground) 6%, transparent), inset -1px 0 0 color-mix(in oklab, var(--color-foreground) 5%, transparent)",
      }}
      className="fixed left-0 top-0 bottom-0 z-[80] w-[340px] max-w-[88vw] flex flex-col"
    >
      <motion.div
        variants={innerContainer}
        initial="hidden"
        animate="show"
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* mt-[29px] + h-10 mirrors the trigger's box so the caption sits on the
            same baseline as the floating menu toggle. pl-[58px] aligns the
            caption text with the "New conversation" label below it (the X icon,
            centered at x=35, lines up with the + icon; the wider gap matches the
            row's gap-4). */}
        <motion.div
          variants={innerItem}
          className="mt-[29px] mb-2 flex h-10 items-center pl-[58px] pr-6"
        >
          <span
            className="font-sans text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "color-mix(in oklab, var(--color-foreground) 45%, transparent)" }}
          >
            Conversations
          </span>
        </motion.div>

        <motion.div variants={innerItem} className="px-4 pb-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/" });
            }}
            className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left"
            style={{
              background: "color-mix(in oklab, var(--color-foreground) 4%, transparent)",
              color: "color-mix(in oklab, var(--color-foreground) 78%, transparent)",
            }}
          >
            <span className="opacity-55">
              <PlusIcon />
            </span>
            <span className="text-[13px]">New conversation</span>
          </button>
        </motion.div>

        <motion.div
          variants={innerItem}
          className="flex-1 min-h-0 overflow-y-auto px-2 pb-6 pt-2"
        >
          {threads.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-1 text-center text-[12px]"
              style={{ color: "color-mix(in oklab, var(--color-foreground) 35%, transparent)" }}
            >
              <span>Nothing here yet.</span>
              <span>Your conversations will quietly gather.</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* initial={false}: existing rows appear instantly when the panel
                  opens; only rows added/removed afterwards animate. layout lets
                  the rows below glide up to fill the gap left by a deleted one. */}
              <AnimatePresence initial={false}>
                {threads.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, x: -12 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    style={{ overflow: "hidden" }}
                  >
                    <ThreadRow
                      thread={t}
                      active={activeId === t.id}
                      onOpen={() => {
                        if (activeId === t.id) {
                          setOpen(false);
                          return;
                        }
                        void navigate({ to: "/c/$threadId", params: { threadId: t.id } });
                      }}
                      onDelete={() => {
                        deleteThread(t.id);
                        if (activeId === t.id) {
                          void navigate({ to: "/" });
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.aside>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────────── */

export function ConversationPanel() {
  const [open, setOpen] = useState(false);
  const threads = useThreads();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.startsWith("/c/") ? pathname.slice(3) : null;

  // Route change closes the panel (thread switch, new conversation, …).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // History belongs to the chat surface; on other pages (profile, about, …)
  // the trigger would fight their own top-left UI.
  const onChatSurface = pathname === "/" || pathname.startsWith("/c/");
  if (!onChatSurface) return null;

  return (
    <>
      {/* Sits above the panel (z-90 > z-80) so the morphing X stays visible
          and clickable while the panel is open — it doubles as the close
          control. Both the label inside MenuToggle and the button itself
          resolve to the same `!open` value, so a click toggles exactly once.

          Sized (h-10/w-10) and vertically centered (top-[29px]) to share the
          nav dock's 40px footprint and y=49 baseline, so the trigger reads as
          part of the same row rather than a faint afterthought. */}
      <button
        type="button"
        aria-label="Conversations"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group fixed top-[29px] left-[15px] z-[90] grid h-10 w-10 place-items-center rounded-full"
        style={{ color: "var(--color-foreground)" }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at center, color-mix(in oklab, var(--color-foreground) 10%, transparent), transparent 70%)",
          }}
        />
        <span className="relative opacity-60 transition-opacity duration-300 group-hover:opacity-100">
          {/* strokeWidth 2.5 over the 32-unit viewBox matches the nav glyphs'
              optical stroke weight at this 20px display size. */}
          <MenuToggle open={open} strokeWidth={2.5} className="size-5" />
        </span>
      </button>

      {/* Backdrop and panel are separate keyed children of AnimatePresence —
          NOT wrapped in a fragment. AnimatePresence can't read keys through a
          Fragment, so a fragment child makes it unmount instantly on close
          (the exit animation never plays). Two direct conditionals fix that. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: FADE_EASE }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[70]"
            style={{
              background: "color-mix(in oklab, var(--color-background) 60%, transparent)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
        )}

        {open && (
          <PanelSurface
            key="panel"
            threads={threads}
            activeId={activeId}
            navigate={navigate}
            setOpen={setOpen}
          />
        )}
      </AnimatePresence>
    </>
  );
}
