// Demo device so the UI can be tried without a keyboard.
import type { Device, Behavior, Keymap, PhysicalLayouts, BehaviorBinding } from "./device";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import type { Notification } from "@zmkfirmware/zmk-studio-ts-client";
import { encodeUsage, PAGE_KEYBOARD as K } from "./hid";

const behaviors: Behavior[] = [
  { id: 1, displayName: "Key Press", metadata: [{ param1: [{ name: "Key", hidUsage: { keyboardMax: 0xff, consumerMax: 0x2ff } }], param2: [] }] },
  { id: 2, displayName: "Momentary Layer", metadata: [{ param1: [{ name: "Layer", layerId: {} }], param2: [] }] },
  { id: 3, displayName: "Toggle Layer", metadata: [{ param1: [{ name: "Layer", layerId: {} }], param2: [] }] },
  { id: 4, displayName: "Layer-Tap", metadata: [{ param1: [{ name: "Layer", layerId: {} }], param2: [{ name: "Tap", hidUsage: { keyboardMax: 0xff, consumerMax: 0 } }] }] },
  { id: 5, displayName: "Mod-Tap", metadata: [{ param1: [{ name: "Hold", hidUsage: { keyboardMax: 0xff, consumerMax: 0 } }], param2: [{ name: "Tap", hidUsage: { keyboardMax: 0xff, consumerMax: 0 } }] }] },
  { id: 6, displayName: "Transparent", metadata: [] },
  { id: 7, displayName: "None", metadata: [] },
  { id: 8, displayName: "Bluetooth", metadata: [
    { param1: [{ name: "Clear", constant: 0 }, { name: "Next", constant: 1 }, { name: "Prev", constant: 2 }], param2: [] },
    { param1: [{ name: "Select", constant: 3 }], param2: [{ name: "Profile", range: { min: 0, max: 4 } }] },
  ] },
];

// 3x5+3 split (36 keys)
function layout(): PhysicalLayouts {
  const keys = [];
  for (let side = 0; side < 2; side++)
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5; col++) {
        const x = side === 0 ? col : col + 7;
        const stagger = [0.3, 0.1, 0, 0.1, 0.2][side === 0 ? col : 4 - col];
        keys.push({ width: 100, height: 100, x: x * 100, y: Math.round((row + stagger) * 100), r: 0, rx: 0, ry: 0 });
      }
  // reorder to row-major (L row then R row) like typical keymaps
  const ordered = [];
  for (let row = 0; row < 3; row++)
    for (let side = 0; side < 2; side++)
      for (let col = 0; col < 5; col++) ordered.push(keys[side * 15 + row * 5 + col]);
  const thumbs = [
    { x: 250, y: 340, r: 0 }, { x: 360, y: 355, r: 1200 }, { x: 465, y: 400, r: 2400 },
    { x: 735, y: 400, r: -2400 }, { x: 840, y: 355, r: -1200 }, { x: 950, y: 340, r: 0 },
  ].map((t) => ({ width: 100, height: 100, x: t.x, y: t.y, r: t.r, rx: t.x + 50, ry: t.y + 50 }));
  return { activeLayoutIndex: 0, layouts: [{ name: "Default", keys: [...ordered, ...thumbs] }] };
}

const kp = (id: number, mods = 0): BehaviorBinding => ({ behaviorId: 1, param1: encodeUsage(K, id, mods), param2: 0 });
const letters = (s: string) => s.split("").map((c) => {
  const map: Record<string, number> = { ";": 0x33, ",": 0x36, ".": 0x37, "/": 0x38, "'": 0x34 };
  if (map[c]) return kp(map[c]);
  if (/[0-9]/.test(c)) return kp(c === "0" ? 0x27 : 0x1e + Number(c) - 1);
  return kp(0x04 + c.charCodeAt(0) - 65);
});
const trans: BehaviorBinding = { behaviorId: 6, param1: 0, param2: 0 };

function keymap(): Keymap {
  const base = [
    ...letters("QWERTYUIOP"), ...letters("ASDFGHJKL;"), ...letters("ZXCVBNM,./"),
    kp(0xe3), { behaviorId: 2, param1: 1, param2: 0 }, kp(0x2c),
    kp(0x28), { behaviorId: 2, param1: 2, param2: 0 }, kp(0x2a),
  ];
  const num = [
    ...letters("1234567890"),
    kp(0x2b), ...Array(4).fill(trans), kp(0x50), kp(0x51), kp(0x52), kp(0x4f), kp(0x34),
    kp(0xe1), ...Array(9).fill(trans),
    ...Array(6).fill(trans),
  ];
  const fn = [
    ...Array.from({ length: 10 }, (_, i) => kp(0x3a + i)),
    { behaviorId: 8, param1: 3, param2: 0 }, { behaviorId: 8, param1: 3, param2: 1 }, { behaviorId: 8, param1: 3, param2: 2 }, { behaviorId: 8, param1: 0, param2: 0 }, trans,
    ...Array(5).fill(trans),
    ...Array(10).fill(trans),
    ...Array(6).fill(trans),
  ];
  return {
    availableLayers: 4,
    maxLayerNameLength: 20,
    layers: [
      { id: 0, name: "Base", bindings: base },
      { id: 1, name: "Num", bindings: num },
      { id: 2, name: "Fn", bindings: fn },
    ],
  };
}

export function createMockDevice(): Device {
  let saved = keymap();
  let current = structuredClone(saved);
  const listeners: ((n: Notification) => void)[] = [];
  let lastUnsaved = false;
  const notify = () => {
    const u = JSON.stringify(saved) !== JSON.stringify(current);
    if (u !== lastUnsaved) {
      lastUnsaved = u;
      listeners.forEach((l) => l({ keymap: { unsavedChangesStatusChanged: u } }));
    }
  };
  return {
    label: "Demo",
    getDeviceName: async () => "Demo Split 36",
    getLockState: async () => LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED,
    getBehaviors: async () => behaviors,
    getKeymap: async () => structuredClone(current),
    getPhysicalLayouts: async () => layout(),
    async setBinding(layerId, pos, b) {
      const layer = current.layers.find((l) => l.id === layerId);
      if (!layer || !layer.bindings[pos]) return "キー位置が不正です";
      layer.bindings[pos] = { ...b };
      notify();
      return null;
    },
    async setLayerName(layerId, name) {
      const layer = current.layers.find((l) => l.id === layerId);
      if (!layer) return false;
      layer.name = name;
      notify();
      return true;
    },
    checkUnsaved: async () => JSON.stringify(saved) !== JSON.stringify(current),
    async save() {
      saved = structuredClone(current);
      notify();
      return null;
    },
    async discard() {
      current = structuredClone(saved);
      notify();
      return true;
    },
    onNotification: (cb) => listeners.push(cb),
    disconnect: () => {},
  };
}
