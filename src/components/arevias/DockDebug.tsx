import { useEffect, useState } from "react";

// Diagnostic probe — ONLY active with ?kbdebug=1 in the URL (invisible to real
// users). Shows live keyboard/scroll state at the top of the screen so the
// "messages hidden when keyboard opens" bug can be diagnosed via screenshot.
// Remove once diagnosed.
export function DockDebug() {
  const [out, setOut] = useState("kbdebug…");
  const active =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("kbdebug");

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const root = document.documentElement;
      const vv = window.visualViewport;
      const conv = document.querySelector<HTMLElement>(".arevias-conversation");
      const scr = document.querySelector<HTMLElement>(".arevias-conversation-scroll");
      const cs = root.style;
      const atBottom =
        scr ? scr.scrollHeight - scr.scrollTop - scr.clientHeight : -1;
      setOut(
        [
          `focusAttr=${root.dataset.areviasChatInputFocus ?? "-"}`,
          `winScrollY=${Math.round(window.scrollY)} pageYOff=${Math.round(window.pageYOffset)}`,
          `vv.height=${vv ? Math.round(vv.height) : "-"} vv.offsetTop=${vv ? Math.round(vv.offsetTop) : "-"} innerH=${window.innerHeight}`,
          `var.visualH=${cs.getPropertyValue("--arevias-visual-height") || "-"} var.kbOffset=${cs.getPropertyValue("--arevias-keyboard-offset") || "-"}`,
          `conv.h=${conv ? Math.round(conv.getBoundingClientRect().height) : "-"}`,
          `scroll.clientH=${scr ? scr.clientHeight : "-"} scrollH=${scr ? scr.scrollHeight : "-"} scrollTop=${scr ? Math.round(scr.scrollTop) : "-"}`,
          `distFromBottom=${Math.round(atBottom)}`,
          `path=${location.pathname}`,
        ].join("\n"),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 99999,
        background: "#fff",
        color: "#000",
        fontFamily: "monospace",
        fontSize: 10,
        lineHeight: 1.35,
        padding: "6px 10px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        borderBottom: "2px solid red",
        pointerEvents: "none",
      }}
    >
      {out}
    </div>
  );
}
