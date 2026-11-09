import type { PhysicalLayout } from "@zmkfirmware/zmk-studio-ts-client/keymap";

const U = 54; // px per key unit; ZMK sends sizes in centi-units, rotation in centi-degrees

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

  return (
    <div className="kb-scroll">
      <div className="kb" style={{ width: w * U + 8, height: h * U + 8 }}>
        {layout.keys.map((k, i) => {
          const l = labels[i] ?? { main: "", sub: "" };
          return (
            <button
              key={i}
              className={`key${selected === i ? " selected" : ""}${l.main === "▽" ? " trans" : ""}`}
              style={{
                left: ((k.x - minX) / 100) * U + 4,
                top: ((k.y - minY) / 100) * U + 4,
                width: (k.width / 100) * U - 4,
                height: (k.height / 100) * U - 4,
                transformOrigin: `${((k.rx - k.x) / 100) * U}px ${((k.ry - k.y) / 100) * U}px`,
                transform: k.r ? `rotate(${k.r / 100}deg)` : undefined,
              }}
              onClick={() => onSelect(i)}
              title={`キー ${i}`}
            >
              {l.sub && <span className="sub">{l.sub}</span>}
              <span className="main">{l.main}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
