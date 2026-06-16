import { useLayoutEffect, useState } from "react";

// Diagnostic probe — ONLY active when the URL has ?dockdebug=1, so it is
// invisible to real users. Captures the dock size from the earliest mount
// frame (useLayoutEffect runs before paint) to catch the load/hydration flash
// that a post-load console script can't see. Remove once diagnosed.
export function DockDebug() {
  const [out, setOut] = useState("starting…");
  const active =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("dockdebug");

  useLayoutEffect(() => {
    if (!active) return;
    const first: string[] = [];
    let maxW = 0;
    let maxInfo = "(never grew)";
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const dock = document.querySelector<HTMLElement>(".arevias-top-dock");
      const it = dock?.querySelector<HTMLElement>(":scope > div");
      const w = it ? Math.round(it.getBoundingClientRect().width) : -1;
      const dr = dock?.getBoundingClientRect();
      if (frame < 12) {
        first.push(
          `f${frame}: w=${w} top=${dr ? Math.round(dr.top) : "-"} dockEl=${dock ? "Y" : "N"}`,
        );
      }
      if (w > maxW) {
        maxW = w;
        maxInfo = `itemW=${w} dockTop=${dr ? Math.round(dr.top) : "-"} dockH=${dr ? Math.round(dr.height) : "-"} cssW=${it ? getComputedStyle(it).width : "-"} dockTf=${dock ? getComputedStyle(dock).transform : "-"} itemClass=${it ? it.className : "-"}`;
      }
      frame++;
      if (performance.now() - start < 4000) requestAnimationFrame(tick);
      else
        setOut(
          `BIGGEST: ${maxInfo}\n\nFIRST FRAMES:\n${first.join("\n")}\n\npath=${location.pathname}`,
        );
    };
    requestAnimationFrame(tick);
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: "#fff",
        color: "#000",
        fontFamily: "monospace",
        fontSize: 10,
        lineHeight: 1.35,
        padding: "8px 10px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        borderTop: "2px solid red",
      }}
    >
      {out}
    </div>
  );
}
