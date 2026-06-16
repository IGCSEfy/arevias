import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

/* ── Edge fade for horizontally-scrollable rows ───────────────────────────────
 * Returns a ref + inline mask style. The mask softly fades content at an edge
 * only when there's more to scroll in that direction — so a non-overflowing row
 * stays crisp, and an overflowing one hints at the hidden content instead of
 * hard-clipping it. Apply the ref + style to the `overflow-x-auto` element. */
export function useEdgeFade<T extends HTMLElement>(fade = 24) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Recompute which edges have hidden content. Reads ref + setState only, so a
  // stale closure is harmless — safe to call from onScroll, RO, and resize.
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  };

  // Initial measurement after layout settles, plus react to size changes. Scroll
  // is wired through the returned `onScroll` so it binds to the rendered node.
  useEffect(() => {
    // `update` null-checks the ref itself, so schedule unconditionally — the
    // ref may not be attached on the very first effect run.
    const measure = () => requestAnimationFrame(update);
    measure();
    window.addEventListener("resize", measure);
    // The display font loads late and reflows the pills, changing what
    // overflows — re-measure once it's ready, plus a short safety net for any
    // remaining late layout shift.
    document.fonts?.ready.then(measure).catch(() => {});
    const t = setTimeout(update, 250);
    const el = ref.current;
    const ro = el ? new ResizeObserver(measure) : null;
    ro?.observe(el!);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const l = edges.left ? `${fade}px` : "0px";
  const r = edges.right ? `${fade}px` : "0px";
  const mask = `linear-gradient(to right, transparent 0, #000 ${l}, #000 calc(100% - ${r}), transparent 100%)`;
  return {
    ref,
    onScroll: update,
    style: { WebkitMaskImage: mask, maskImage: mask } as const,
  };
}

/* ── Page header (serif display title + subtitle) ─────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mb-7 grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-[1.05] tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="w-full sm:w-auto sm:shrink-0">{right}</div>}
    </motion.header>
  );
}

/* ── Tabs (rounded pill row, animated ink selector) ───────────────────────── */

export function Tabs({
  tabs,
  value,
  onChange,
  layoutId = "profile-tab-pill",
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  layoutId?: string;
}) {
  const fade = useEdgeFade<HTMLDivElement>();
  return (
    <div
      ref={fade.ref}
      onScroll={fade.onScroll}
      style={fade.style}
      className="mb-6 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-soft p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="relative whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium"
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 z-0 rounded-full bg-ink"
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              />
            )}
            {/* z-10: keep the label above the animated pill. iOS Safari paints
                the transformed layoutId pill over a sibling with `z-index: auto`,
                which hid the active label (black-on-black). */}
            <span className={cn("relative z-10", active ? "text-ink-foreground" : "text-muted-foreground")}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Card (light surface, or ink accent panel) ────────────────────────────── */

export function Card({
  children,
  className = "",
  ink = false,
}: {
  children: ReactNode;
  className?: string;
  ink?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--radius)+8px)] p-6",
        ink ? "bg-ink text-ink-foreground shadow-ink" : "border border-border bg-surface shadow-elevated",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Field (uppercase label + control + hint) ─────────────────────────────── */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/* ── Inputs ───────────────────────────────────────────────────────────────── */

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground transition placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/20",
        className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-foreground transition placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/20",
        className,
      )}
    />
  );
}

/* ── Button ───────────────────────────────────────────────────────────────── */

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger";
}) {
  const variants = {
    primary: "bg-ink text-ink-foreground hover:bg-ink/90",
    ghost: "border border-border bg-transparent text-foreground hover:bg-soft",
    soft: "border border-border bg-soft text-foreground hover:bg-accent",
    danger: "border border-red-500/30 bg-transparent text-red-600 hover:bg-red-500/10",
  } as const;
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Toggle (spring) ──────────────────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-ink" : "bg-border",
        disabled && "opacity-50",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-surface shadow",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ── Segmented (preserves real string values; animated selector) ──────────── */

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  // Unique per instance — deriving from option values collides when two
  // controls share the same options (e.g. Never/Mirror me/Freely), making the
  // sliding pill jump between separate controls.
  const layoutId = useId();
  return (
    <div className="inline-flex w-full min-w-0 items-center overflow-hidden rounded-xl border border-border bg-soft p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="relative min-w-0 flex-1 rounded-[10px] px-2 py-1.5 text-xs font-medium sm:px-3"
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-[10px] border border-border bg-surface shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className={cn("relative block truncate", active ? "text-foreground" : "text-muted-foreground")}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */

export function Chip({
  children,
  ink = false,
  className,
}: {
  children: ReactNode;
  ink?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        ink ? "bg-ink text-ink-foreground" : "border border-border bg-soft text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Status dot ───────────────────────────────────────────────────────────── */

export function StatusDot({ on }: { on: boolean }) {
  return (
    <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", on ? "bg-ink" : "bg-border")} />
  );
}

/* ── Detail (key / value) ─────────────────────────────────────────────────── */

export function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 break-words text-sm text-foreground", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

/* ── Hairline ─────────────────────────────────────────────────────────────── */

export function Hairline({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

/* ── Copy field (inline value + animated copy button) ─────────────────────── */

export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-soft py-1 pl-2.5 pr-1",
        className,
      )}
    >
      <span className="truncate font-mono text-xs text-foreground">{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy"}
        className="relative grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className={cn("transition-all", copied ? "scale-100 opacity-100" : "scale-0 opacity-0")}>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        </span>
        <span className={cn("absolute transition-all", copied ? "scale-0 opacity-0" : "scale-100 opacity-100")}>
          <Copy className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}

/* ── Coming-soon (striped overlay) ────────────────────────────────────────── */

export function ComingSoon({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="relative">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">{title}</h3>
          <Chip ink>Coming soon</Chip>
        </div>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </Card>
  );
}

/* ── Preview tile (dimmed product preview) ────────────────────────────────── */

export function PreviewTile({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-soft">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <Chip>Soon</Chip>
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
