import { useState, type ComponentType, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ── Shared control classes (monochrome, subtle rounding) ───────────────── */

export const inputCls =
  "h-9 w-full rounded-xl border border-transparent bg-secondary px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring";

export const textareaCls =
  "w-full resize-none rounded-xl border border-transparent bg-secondary px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring";

export const selectCls =
  "h-9 w-full rounded-xl border border-transparent bg-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-ring [&>option]:bg-card";

/* ── Panel ───────────────────────────────────────────────────────────────── */

/**
 * Elevated dark card — the single surface every dashboard/profile card flows
 * through, so the look stays uniform. Soft 16px rounding, a barely-there
 * border, and a faintly-lifted fill read as a solid panel floating just above
 * the near-black page. No internal header divider: the title block is set off
 * by whitespace alone, which keeps the card calm and uncluttered.
 *
 * The `dots` prop is accepted for backwards-compatibility but no longer alters
 * the look — the old dashed-border + green-corner-dot treatment was retired in
 * favour of this single clean surface.
 */
export function Panel({
  title,
  description,
  action,
  footer,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** @deprecated No longer changes the appearance — kept so existing call
   *  sites compile. All cards now share the one clean surface. */
  dots?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card text-card-foreground",
        className,
      )}
    >
      <div className={cn("p-5", bodyClassName)}>
        {(title || action) && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && <h3 className="text-base font-semibold leading-none tracking-tight">{title}</h3>}
              {description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        {children}
        {footer && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────────────── */

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/* ── Contextual tab bar (underline) ──────────────────────────────────────── */

export function TabBar({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "relative whitespace-nowrap px-3 py-2 text-sm transition-colors",
            value === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-px bg-foreground" />}
        </button>
      ))}
    </div>
  );
}

/* ── Tag (subtle, monochrome — replaces pill badges) ─────────────────────── */

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Status dot ──────────────────────────────────────────────────────────── */

export function StatusDot({ on }: { on: boolean }) {
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", on ? "bg-foreground" : "bg-muted-foreground/30")} />;
}

/* ── Meter (thin progress bar) ───────────────────────────────────────────── */

export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ── Ring (small radial progress) ────────────────────────────────────────── */

export function Ring({ value, size = 52, stroke = 4, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="text-foreground transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ── Field (label + control) ─────────────────────────────────────────────── */

export function Field({ label, hint, meta, children }: { label: string; hint?: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {meta}
      </div>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

/* ── Toggle row ──────────────────────────────────────────────────────────── */

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/* ── Segmented control ───────────────────────────────────────────────────── */

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-input bg-black/20 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Chip multi-select (wrapping, for larger option sets) ────────────────── */

export function ChipMultiSelect({
  options,
  values,
  onChange,
  conflicts,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  /** value → values it cannot coexist with (cleared when this one is picked). */
  conflicts?: Record<string, string[]>;
}) {
  const toggle = (v: string) => {
    if (values.includes(v)) {
      onChange(values.filter((x) => x !== v));
      return;
    }
    const banned = conflicts?.[v] ?? [];
    onChange([...values.filter((x) => !banned.includes(x)), v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input bg-black/20 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Detail row (key / value) ────────────────────────────────────────────── */

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm">{children}</span>
    </div>
  );
}

/* ── Copyable value ──────────────────────────────────────────────────────── */

export function CopyValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-input bg-black/20 py-1 pl-2.5 pr-1 transition-colors hover:bg-secondary",
        className,
      )}
    >
      <span className="truncate font-mono text-xs text-muted-foreground">{value}</span>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-6 w-6 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground disabled:opacity-100"
              onClick={handleCopy}
              aria-label={copied ? "Copied" : "Copy to clipboard"}
              disabled={copied}
            >
              <div
                className={cn(
                  "transition-all",
                  copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
                )}
              >
                <Check className="stroke-emerald-500" size={14} strokeWidth={2} aria-hidden="true" />
              </div>
              <div
                className={cn(
                  "absolute transition-all",
                  copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
                )}
              >
                <Copy size={14} strokeWidth={2} aria-hidden="true" />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="px-2 py-1 text-xs">
            {copied ? "Copied" : "Click to copy"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/* ── Future preview (premium "coming soon" surface) ──────────────────────── */

export function FuturePreview({
  icon: Icon,
  title,
  description,
  capabilities,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  capabilities: { icon: ComponentType<{ className?: string }>; title: string; note: string }[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-secondary/50">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 max-w-xl">
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-base font-medium">{title}</h3>
                <Tag>Coming soon</Tag>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2">
            {capabilities.map((c) => {
              const CIcon = c.icon;
              return (
                <div key={c.title} className="flex items-start gap-3">
                  <CIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{c.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
      {children}
    </div>
  );
}

/* ── Preview card (dimmed, non-interactive product preview) ──────────────── */

export function PreviewCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-secondary/50">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <Tag>Preview</Tag>
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
