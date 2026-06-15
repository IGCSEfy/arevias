import { type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface MotionButtonProps {
  /** Centered content — a label, or anything (e.g. a busy indicator). */
  children: ReactNode;
  /** Left icon shown on the circle. Defaults to an arrow. */
  icon?: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Pill button with a circle on the left that expands to fill on hover, the
 * label inverting to the circle's contrast colour as it does. Generalized from
 * the 21st.dev "motion-button" so it can back real form controls: custom left
 * icon, submit/disabled support, and arbitrary centered content.
 */
export function MotionButton({
  children,
  icon,
  type = "button",
  onClick,
  disabled,
  className,
}: MotionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative h-12 w-full cursor-pointer overflow-hidden rounded-full border border-border bg-background p-1 outline-none disabled:cursor-not-allowed",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="block h-10 w-10 rounded-full bg-primary transition-all duration-500 ease-out group-hover:w-[calc(100%-0.5rem)]"
      />
      <span className="absolute top-1/2 left-3.5 -translate-y-1/2 transition-transform duration-500 ease-out group-hover:translate-x-[0.3rem]">
        {icon ?? <ArrowRight className="size-5 text-background" />}
      </span>
      <span className="absolute top-1/2 left-1/2 ml-3.5 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-sm font-medium tracking-tight text-foreground transition-colors duration-500 ease-out group-hover:text-background">
        {children}
      </span>
    </button>
  );
}

export default MotionButton;
