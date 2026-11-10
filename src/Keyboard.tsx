import { useLayoutEffect, useRef, useState } from "react";
import type { PhysicalLayout } from "@zmkfirmware/zmk-studio-ts-client/keymap";

// ZMK sends sizes in centi-units and rotation in centi-degrees.
const MAX_U = 64; // px per key unit at most
const MIN_U = 26;
const PAD = 6;

export function Keyboard({
  layout,
  labels,
  selected,
  onSelect,
}: {
  layout: PhysicalLayout;
  labels: { main: string; sub: string }[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const corners = layout.keys.flatMap((k) => {
    const pts = [
      [k.x, k.y], [k.x + k.width, k.y], [k.x, k.y + k.height], [k.x + k.width, k.y + k.height],
    ];
    const a = (k.r / 100) * (Math.PI / 180);
    return pts.map(([x, y]) => {
      if (!k.r) return [x, y];
      const dx = x - k.rx, dy = y - k.ry;
      return [k.rx + dx * Math.cos(a) - dy * Math.sin(a), k.ry + dx * Math.sin(a) + dy * Math.cos(a)];
    });
  });
  const minX = Math.min(...corners.map((c) => c[0]));
  const minY = Math.min(...corners.map((c) => c[1]));
  const w = (Math.max(...corners.map((c) => c[0])) - minX) / 100;
  const h = (Math.max(...corners.map((c) => c[1])) - minY) / 100;

  // Fit the board to the available width.
  const wrap = useRef<HTMLDivElement>(null);
  const [U, setU] = useState(54);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const avail = inner - PAD * 2 - 4;
      setU(Math.max(MIN_U, Math.min(MAX_U, Math.floor(avail / w))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  const fontScale = U / 54;

  return (
    <div className="kb-wrap" ref={wrap}>
      <div
        className="kb"
        style={{ width: w * U + PAD * 2, height: h * U + PAD * 2, ["--fs" as string]: fontScale }}
      >
        {layout.keys.map((k, i) => {
          const l = labels[i] ?? { main: "", sub: "" };
          const kind = l.main === "▽" ? " trans" : !l.main && !l.sub ? " none" : l.sub ? " special" : "";
          return (
            <button
              key={i}
              className={`key${kind}${selected === i ? " selected" : ""}`}
              style={{
                left: ((k.x - minX) / 100) * U + PAD,
                top: ((k.y - minY) / 100) * U + PAD,
                width: (k.width / 100) * U - 5,
                height: (k.height / 100) * U - 5,
                transformOrigin: `${((k.rx - k.x) / 100) * U}px ${((k.ry - k.y) / 100) * U}px`,
                transform: k.r ? `rotate(${k.r / 100}deg)` : undefined,
              }}
              onClick={() => onSelect(i)}
              aria-label={`キー ${i}: ${[l.sub, l.main].filter(Boolean).join(" ") || "なし"}`}
              aria-pressed={selected === i}
            >
              <span className="cap">
                {l.sub && <span className="sub">{l.sub}</span>}
                <span className="main">{l.main}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
