import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/** Home-page footer: copyright + legal links. */
export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("px-6", className)}>
      <div className="mx-auto max-w-5xl border-t border-foreground/10 pt-8 pb-12 text-center sm:pt-10 sm:pb-16">
        <p className="font-mono text-sm tracking-[0.25em] text-muted-foreground">
          © {new Date().getFullYear()} Nanoris
        </p>
        <p className="mt-3 font-mono text-xs tracking-wide text-muted-foreground/80">
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <span className="mx-2 opacity-50">·</span>
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms of Use
          </Link>
        </p>
      </div>
    </footer>
  );
}
