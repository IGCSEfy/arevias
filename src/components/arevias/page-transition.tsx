import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * Route-transition reveal — pure React state + CSS (no animation library).
 *
 * On every navigation the content is reset to its hidden/blurred start state,
 * then a tick later `.is-loaded` is applied so the CSS transition fades it up.
 * Keyed on the pathname so it replays on every route change, not just the
 * first load. The wrapper paints black immediately (dark mode) so the first
 * frame is never white and content never flashes before the animation runs.
 *
 * `dark` controls the black backdrop + animated blobs; turn it off for light
 * pages (e.g. the profile console) so only the blur-fade-up reveal applies.
 */
export function PageTransition({
  children,
  dark = true,
  fast = false,
}: {
  children: ReactNode;
  dark?: boolean;
  /** Slightly quicker reveal — used on the profile console. */
  fast?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={cn(
        "arevias-page-transition",
        dark && "arevias-page-transition--dark",
        fast && "arevias-page-transition--fast",
        loaded && "is-loaded",
      )}
    >
      {dark && (
        <div aria-hidden className="arevias-page-blobs">
          <span className="arevias-page-blob arevias-page-blob-1" />
          <span className="arevias-page-blob arevias-page-blob-2" />
          <span className="arevias-page-blob arevias-page-blob-3" />
        </div>
      )}
      <div className="arevias-page-content">{children}</div>
    </div>
  );
}
