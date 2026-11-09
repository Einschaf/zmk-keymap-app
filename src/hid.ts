// HID usage helpers. ZMK encodes &kp params as:
//   bits 24-31: implicit modifiers, bits 16-23: usage page, bits 0-15: usage id
export const PAGE_KEYBOARD = 0x07;
export const PAGE_CONSUMER = 0x0c;

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

export function encodeUsage(page: number, id: number, mods = 0): number {
  return ((mods & 0xff) << 24) | ((page & 0xff) << 16) | (id & 0xffff);
}

export function decodeUsage(v: number) {
  return { mods: (v >>> 24) & 0xff, page: (v >>> 16) & 0xff, id: v & 0xffff };
}

const kb: Record<number, string> = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c, i) => (kb[0x04 + i] = c));
"1234567890".split("").forEach((c, i) => (kb[0x1e + i] = c));
Object.assign(kb, {
  0x28: "Enter", 0x29: "Esc", 0x2a: "Bksp", 0x2b: "Tab", 0x2c: "Space",
  0x2d: "-", 0x2e: "=", 0x2f: "[", 0x30: "]", 0x31: "\\", 0x32: "#",
  0x33: ";", 0x34: "'", 0x35: "`", 0x36: ",", 0x37: ".", 0x38: "/",
  0x39: "Caps", 0x46: "PrtSc", 0x47: "ScrLk", 0x48: "Pause",
  0x49: "Ins", 0x4a: "Home", 0x4b: "PgUp", 0x4c: "Del", 0x4d: "End", 0x4e: "PgDn",
  0x4f: "→", 0x50: "←", 0x51: "↓", 0x52: "↑",
  0x53: "NumLk", 0x54: "KP/", 0x55: "KP*", 0x56: "KP-", 0x57: "KP+", 0x58: "KPEnt",
  0x59: "KP1", 0x5a: "KP2", 0x5b: "KP3", 0x5c: "KP4", 0x5d: "KP5",
  0x5e: "KP6", 0x5f: "KP7", 0x60: "KP8", 0x61: "KP9", 0x62: "KP0", 0x63: "KP.",
  0x64: "NUBS", 0x65: "Menu", 0x87: "Ro(\\_)", 0x88: "Kana", 0x89: "¥",
  0x8a: "Henkan", 0x8b: "Muhenkan", 0x90: "Lang1", 0x91: "Lang2",
  0xe0: "LCtrl", 0xe1: "LShift", 0xe2: "LAlt", 0xe3: "LGUI",
  0xe4: "RCtrl", 0xe5: "RShift", 0xe6: "RAlt", 0xe7: "RGUI",
});
for (let i = 0; i < 12; i++) kb[0x3a + i] = `F${i + 1}`;
for (let i = 0; i < 12; i++) kb[0x68 + i] = `F${i + 13}`;

const consumer: Record<number, string> = {
  0x30: "Power", 0x6f: "Bri+", 0x70: "Bri-", 0xb5: "Next", 0xb6: "Prev",
  0xb7: "Stop", 0xcd: "Play/Pause", 0xe2: "Mute", 0xe9: "Vol+", 0xea: "Vol-",
  0x183: "MediaSel", 0x18a: "Mail", 0x192: "Calc", 0x194: "MyComp",
  0x221: "Search", 0x223: "WWWHome", 0x224: "Back", 0x225: "Fwd",
};

export const USAGE_TABLE: Record<number, Record<number, string>> = {
  [PAGE_KEYBOARD]: kb,
  [PAGE_CONSUMER]: consumer,
};

export function usageLabel(v: number): string {
  const { mods, page, id } = decodeUsage(v);
  const base =
    USAGE_TABLE[page]?.[id] ?? `0x${page.toString(16)}:${id.toString(16)}`;
  const m = MODS.filter((x) => mods & x.bit).map((x) => x.short);
  return m.length ? `${m.join("+")}+${base}` : base;
}

export function usageOptions(page: number, max: number) {
  return Object.entries(USAGE_TABLE[page] ?? {})
    .map(([id, label]) => ({ id: Number(id), label }))
    .filter((o) => o.id <= max)
    .sort((a, b) => a.id - b.id);
}
