import { useEffect, useState } from "react";

// TEMP DEBUG: capture the dock-flash on iOS and show it on-screen so it can be
// screenshotted (no remote inspector needed). Remove once diagnosed.
export function DockDebug() {
  const [info, setInfo] = useState("waiting… open the Profile page");

  useEffect(() => {
    let maxW = 0;
    let raf = 0;
    const tick = () => {
      const dock = document.querySelector<HTMLElement>(".arevias-top-dock");
      if (dock) {
        const item = dock.querySelector<HTMLElement>(":scope > div");
        const r = item?.getBoundingClientRect();
        const dr = dock.getBoundingClientRect();
        const wrap = dock.parentElement;
        const w = r ? Math.round(r.width) : -1;
        if (w > maxW) {
          maxW = w;
          setInfo(
            [
              `itemW=${w} itemH=${r ? Math.round(r.height) : -1}`,
              `dockTop=${Math.round(dr.top)} dockLeft=${Math.round(dr.left)} dockH=${Math.round(dr.height)}`,
              `cssW=${item ? getComputedStyle(item).width : "-"}`,
              `dockTransform=${getComputedStyle(dock).transform}`,
              `wrapTransform=${wrap ? getComputedStyle(wrap).transform : "-"}`,
              `dockClass=${dock.className}`,
              `itemClass=${item ? item.className : "-"}`,
              `path=${location.pathname}`,
            ].join("\n"),
          );
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
      {"BIGGEST DOCK ITEM SEEN:\n" + info}
    </div>
  );
}
