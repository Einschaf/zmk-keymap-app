// HID usage helpers. ZMK encodes &kp params as:
//   bits 24-31: implicit modifiers, bits 16-23: usage page, bits 0-15: usage id
export const PAGE_KEYBOARD = 0x07;
export const PAGE_CONSUMER = 0x0c;

/** The keyboard layout the host OS is set to. It decides which character a usage produces. */
export type HostLayout = "us" | "jis";

export const MODS = [
  { bit: 0x01, label: "LCtrl", short: "C" },
  { bit: 0x02, label: "LShift", short: "S" },
  { bit: 0x04, label: "LAlt", short: "A" },
  { bit: 0x08, label: "LGUI", short: "G" },
  { bit: 0x10, label: "RCtrl", short: "RC" },
  { bit: 0x20, label: "RShift", short: "RS" },
  { bit: 0x40, label: "RAlt", short: "RA" },
  { bit: 0x80, label: "RGUI", short: "RG" },
];
const SHIFT = 0x02 | 0x20;
export const LSHIFT = 0x02;

export function encodeUsage(page: number, id: number, mods = 0): number {
  return (((mods & 0xff) << 24) | ((page & 0xff) << 16) | (id & 0xffff)) >>> 0;
}

export function decodeUsage(v: number) {
  return { mods: (v >>> 24) & 0xff, page: (v >>> 16) & 0xff, id: v & 0xffff };
}

// Non-character keys (same on every layout).
const kb: Record<number, string> = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c, i) => (kb[0x04 + i] = c));
"1234567890".split("").forEach((c, i) => (kb[0x1e + i] = c));
Object.assign(kb, {
  0x28: "Enter", 0x29: "Esc", 0x2a: "Bksp", 0x2b: "Tab", 0x2c: "Space",
  0x39: "Caps", 0x46: "PrtSc", 0x47: "ScrLk", 0x48: "Pause",
  0x49: "Ins", 0x4a: "Home", 0x4b: "PgUp", 0x4c: "Del", 0x4d: "End", 0x4e: "PgDn",
  0x4f: "→", 0x50: "←", 0x51: "↓", 0x52: "↑",
  0x53: "NumLk", 0x54: "KP/", 0x55: "KP*", 0x56: "KP-", 0x57: "KP+", 0x58: "KPEnt",
  0x59: "KP1", 0x5a: "KP2", 0x5b: "KP3", 0x5c: "KP4", 0x5d: "KP5",
  0x5e: "KP6", 0x5f: "KP7", 0x60: "KP8", 0x61: "KP9", 0x62: "KP0", 0x63: "KP.",
  0x64: "NUBS", 0x65: "Menu", 0x88: "かな", 0x8a: "変換", 0x8b: "無変換",
  0x90: "Lang1", 0x91: "Lang2",
  0xe0: "LCtrl", 0xe1: "LShift", 0xe2: "LAlt", 0xe3: "LGUI",
  0xe4: "RCtrl", 0xe5: "RShift", 0xe6: "RAlt", 0xe7: "RGUI",
});
for (let i = 0; i < 12; i++) kb[0x3a + i] = `F${i + 1}`;
for (let i = 0; i < 12; i++) kb[0x68 + i] = `F${i + 13}`;

// Character keys: [unshifted, shifted] as the host OS types them.
const US: Record<number, [string, string]> = {
  0x1e: ["1", "!"], 0x1f: ["2", "@"], 0x20: ["3", "#"], 0x21: ["4", "$"], 0x22: ["5", "%"],
  0x23: ["6", "^"], 0x24: ["7", "&"], 0x25: ["8", "*"], 0x26: ["9", "("], 0x27: ["0", ")"],
  0x2d: ["-", "_"], 0x2e: ["=", "+"], 0x2f: ["[", "{"], 0x30: ["]", "}"], 0x31: ["\\", "|"],
  0x33: [";", ":"], 0x34: ["'", "\""], 0x35: ["`", "~"],
  0x36: [",", "<"], 0x37: [".", ">"], 0x38: ["/", "?"],
};
const JIS: Record<number, [string, string]> = {
  0x1e: ["1", "!"], 0x1f: ["2", "\""], 0x20: ["3", "#"], 0x21: ["4", "$"], 0x22: ["5", "%"],
  0x23: ["6", "&"], 0x24: ["7", "'"], 0x25: ["8", "("], 0x26: ["9", ")"], 0x27: ["0", ""],
  0x2d: ["-", "="], 0x2e: ["^", "~"], 0x89: ["¥", "|"], 0x2f: ["@", "`"], 0x30: ["[", "{"],
  0x32: ["]", "}"], 0x31: ["]", "}"], 0x33: [";", "+"], 0x34: [":", "*"],
  0x36: [",", "<"], 0x37: [".", ">"], 0x38: ["/", "?"], 0x87: ["\\", "_"],
};
const LEGENDS: Record<HostLayout, Record<number, [string, string]>> = { us: US, jis: JIS };

const extraNames: Record<HostLayout, Record<number, string>> = {
  us: { 0x32: "NUHS", 0x87: "Ro", 0x89: "Yen" },
  jis: { 0x35: "半角/全角" },
};

const consumer: Record<number, string> = {
  0x30: "Power", 0x6f: "Bri+", 0x70: "Bri-", 0xb5: "Next", 0xb6: "Prev",
  0xb7: "Stop", 0xcd: "Play/Pause", 0xe2: "Mute", 0xe9: "Vol+", 0xea: "Vol-",
  0x183: "MediaSel", 0x18a: "Mail", 0x192: "Calc", 0x194: "MyComp",
  0x221: "Search", 0x223: "WWWHome", 0x224: "Back", 0x225: "Fwd",
};

function baseName(id: number, layout: HostLayout): string | undefined {
  return LEGENDS[layout][id]?.[0] || extraNames[layout][id] || kb[id];
}

export function usageLabel(v: number, layout: HostLayout): string {
  const { mods, page, id } = decodeUsage(v);
  if (page === PAGE_CONSUMER) {
    return consumer[id] ?? `0x${id.toString(16)}`;
  }
  if (page !== PAGE_KEYBOARD) return `0x${page.toString(16)}:${id.toString(16)}`;
  const legend = LEGENDS[layout][id];
  let rest = mods;
  let base = baseName(id, layout) ?? `0x${id.toString(16)}`;
  // Shift + a character key is shown as the character it types, e.g. S+2 → "@" on US.
  if (legend?.[1] && mods & SHIFT) {
    base = legend[1];
    rest = mods & ~SHIFT;
  }
  const m = MODS.filter((x) => rest & x.bit).map((x) => x.short);
  return m.length ? `${m.join("+")}+${base}` : base;
}

export interface UsageOption {
  key: string; // `${id}:${shift}` — unique value for <select>
  id: number;
  shift: boolean;
  label: string;
}
export interface UsageGroup {
  label: string;
  options: UsageOption[];
}

const SYMBOL_ORDER = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~¥";

function group(label: string, ids: number[], layout: HostLayout, max: number): UsageGroup {
  return {
    label,
    options: ids
      .filter((id) => id <= max && baseName(id, layout))
      .map((id) => ({ key: `${id}:0`, id, shift: false, label: baseName(id, layout)! })),
  };
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function usageGroups(page: number, max: number, layout: HostLayout): UsageGroup[] {
  if (page === PAGE_CONSUMER) {
    return [{
      label: "メディア",
      options: Object.entries(consumer)
        .map(([id, label]) => ({ key: `${id}:0`, id: Number(id), shift: false, label }))
        .filter((o) => o.id <= max),
    }];
  }
  if (page !== PAGE_KEYBOARD) return [];

  // Every character a key can type, with or without Shift, as its own choice.
  const legends = LEGENDS[layout];
  const symbols: UsageOption[] = [];
  const seen = new Set<string>();
  for (const [idStr, [base, shifted]] of Object.entries(legends)) {
    const id = Number(idStr);
    if (id > max) continue;
    const add = (label: string, shift: boolean) => {
      if (!label || /^[0-9]$/.test(label) || seen.has(label)) return;
      seen.add(label);
      symbols.push({ key: `${id}:${shift ? 1 : 0}`, id, shift, label });
    };
    add(base, false);
    add(shifted, true);
  }
  const rank = (s: string) => (SYMBOL_ORDER.includes(s) ? SYMBOL_ORDER.indexOf(s) : 99);
  symbols.sort((a, b) => rank(a.label) - rank(b.label));

  const used = new Set<number>([
    ...range(0x04, 0x27), ...symbols.map((s) => s.id),
    0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x39, ...range(0x46, 0x52), 0x65,
    ...range(0x3a, 0x45), ...range(0x68, 0x73), ...range(0xe0, 0xe7), ...range(0x53, 0x63),
    0x35, 0x88, 0x8a, 0x8b, 0x90, 0x91,
  ]);
  const others = Object.keys(kb).map(Number).concat(Object.keys(extraNames[layout]).map(Number))
    .filter((id) => !used.has(id));

  return [
    group("英字", range(0x04, 0x1d), layout, max),
    group("数字", range(0x1e, 0x27), layout, max),
    { label: "記号", options: symbols },
    group("編集・移動", [0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x4c, 0x49, 0x4a, 0x4d, 0x4b, 0x4e, 0x50, 0x52, 0x51, 0x4f, 0x39, 0x65], layout, max),
    group("日本語入力", layout === "jis" ? [0x35, 0x8b, 0x8a, 0x88, 0x90, 0x91] : [0x8b, 0x8a, 0x88, 0x90, 0x91], layout, max),
    group("ファンクション", [...range(0x3a, 0x45), ...range(0x68, 0x73)], layout, max),
    group("修飾キー", range(0xe0, 0xe7), layout, max),
    group("テンキー", range(0x53, 0x63), layout, max),
    group("その他", [0x46, 0x47, 0x48, ...others], layout, max),
  ].filter((g) => g.options.length);
}

/** Pick the <select> entry that represents the current value. */
export function optionKeyFor(v: number, layout: HostLayout): { key: string; shiftConsumed: boolean } {
  const { mods, id } = decodeUsage(v);
  const legend = LEGENDS[layout][id];
  if (legend?.[1] && mods & SHIFT) return { key: `${id}:1`, shiftConsumed: true };
  return { key: `${id}:0`, shiftConsumed: false };
}
