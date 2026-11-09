import type { Behavior, BehaviorBinding, Keymap } from "./device";
import type {
  BehaviorBindingParametersSet,
  BehaviorParameterValueDescription as Desc,
} from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { usageLabel } from "./hid";

export function descMatches(d: Desc, v: number): boolean {
  if (d.constant !== undefined) return d.constant === v;
  if (d.range) return v >= d.range.min && v <= d.range.max;
  if (d.nil) return v === 0;
  return !!(d.hidUsage || d.layerId);
}

/** The metadata set whose param1 accepts the value (determines how param2 is interpreted). */
export function findSet(b: Behavior, param1: number): BehaviorBindingParametersSet | undefined {
  return b.metadata.find((s) => s.param1.length === 0 || s.param1.some((d) => descMatches(d, param1)));
}

export function describeParam(d: Desc | undefined, v: number, keymap: Keymap): string {
  if (!d) return "";
  if (d.constant !== undefined) return d.name;
  if (d.hidUsage) return usageLabel(v);
  if (d.layerId) return keymap.layers.find((l) => l.id === v)?.name || `L${v}`;
  if (d.range) return String(v);
  return "";
}

export function bindingLabel(
  b: BehaviorBinding,
  behaviors: Map<number, Behavior>,
  keymap: Keymap,
): { main: string; sub: string } {
  const beh = behaviors.get(b.behaviorId);
  if (!beh) return { main: "?", sub: `#${b.behaviorId}` };
  const set = findSet(beh, b.param1);
  const d1 = set?.param1.find((d) => descMatches(d, b.param1));
  const d2 = set?.param2.find((d) => descMatches(d, b.param2));
  const p1 = describeParam(d1, b.param1, keymap);
  const p2 = describeParam(d2, b.param2, keymap);
  const name = beh.displayName;
  if (name === "Key Press") return { main: p1, sub: "" };
  if (name === "Transparent") return { main: "▽", sub: "" };
  if (name === "None") return { main: "", sub: "" };
  if (p2) return { main: p2, sub: `${short(name)} ${p1}` };
  return { main: p1 || short(name), sub: p1 ? short(name) : "" };
}

function short(name: string): string {
  const map: Record<string, string> = {
    "Momentary Layer": "MO", "Toggle Layer": "TG", "Layer-Tap": "LT",
    "Mod-Tap": "MT", "To Layer": "TO", Bluetooth: "BT", "Sticky Key": "SK",
    "Sticky Layer": "SL", "Key Toggle": "KT", "Output Selection": "OUT",
  };
  return map[name] ?? name;
}
