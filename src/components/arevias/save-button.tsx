"use client";

import { type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Save button with a slide-in spinner while saving. Controlled via the `saving`
 * prop so it reflects the real persistence state of the caller.
 */
export function SaveButton({
  onClick,
  saving = false,
  disabled = false,
  children = "Save",
}: {
  onClick?: () => void;
  saving?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || saving}
      size="sm"
      className={cn(
        "relative justify-center cursor-pointer inline-flex items-center text-center",
        "ease-out duration-200 rounded-md outline-none transition-all outline-0",
        "focus-visible:outline-4 focus-visible:outline-offset-1",
        // The profile theme's large --radius makes the theme-linked `rounded-md`
        // ~12px (pill-ish). Pin to the demo's intended 6px corners.
        "!rounded-[6px]",
        // Never dim — stays full-strength green even when disabled.
        "disabled:!opacity-100",
        "!h-[26px] !px-2.5 !py-1 !text-xs",
        // Bright mint at rest, darker green on hover — applied unconditionally
        // (no `dark:` variants) so the resting colour stays consistent in every
        // surface instead of flipping to the dark-theme green.
        "bg-[hsl(151.3deg_66.9%_66.9%)]",
        "hover:bg-[hsl(156.5deg_86.5%_26.1%)]/90",
        "text-foreground",
        "!border !border-[hsl(var(--brand-500)_/_0.75)]",
        "hover:!border-[hsl(156.5deg_86.5%_26.1%)]",
        saving && [
          "!pl-7",
          "!bg-[hsl(156.5deg_86.5%_26.1%)]/90",
          "!border-[hsl(156.5deg_86.5%_26.1%)]",
        ],
      )}
      style={{
        "--brand-500": "155.3deg 78.4% 40%",
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "absolute left-2.5 transition-all duration-200 ease-in-out opacity-0 -translate-x-2",
            saving && "opacity-100 translate-x-0",
          )}
        >
          <LoaderCircle
            className="animate-spin"
            size={12}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
        <span>{children}</span>
      </div>
    </Button>
  );
}
