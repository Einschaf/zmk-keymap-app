// Export the keymap on one keyboard to a file and apply it to another.
// Behavior ids are assigned per firmware build, so bindings are stored by
// behavior name, and layer parameters are stored as layer indices.
import type { Behavior, BehaviorBinding, Keymap } from "./device";
import { descMatches, findSet } from "./bindings";

const FORMAT = "zmk-keymap-app/keymap";
const VERSION = 1;

interface FileBinding {
  behavior: string;
  param1: number;
  param2: number;
}
interface FileLayer {
  name: string;
  bindings: FileBinding[];
}
export interface KeymapFile {
  format: typeof FORMAT;
  version: number;
  device: string;
  exportedAt: string;
  layers: FileLayer[];
}

/** Which params of this binding refer to a layer. */
function layerParams(beh: Behavior | undefined, param1: number) {
  const set = beh ? findSet(beh, param1) : undefined;
  return {
    p1: !!set?.param1.find((d) => descMatches(d, param1))?.layerId,
    p2: !!set?.param2.some((d) => d.layerId),
  };
}

export function exportKeymap(keymap: Keymap, behaviors: Behavior[], device: string): KeymapFile {
  const byId = new Map(behaviors.map((b) => [b.id, b]));
  const idToIndex = new Map(keymap.layers.map((l, i) => [l.id, i]));
  return {
    format: FORMAT,
    version: VERSION,
    device,
    exportedAt: new Date().toISOString(),
    layers: keymap.layers.map((l) => ({
      name: l.name,
      bindings: l.bindings.map((b) => {
        const beh = byId.get(b.behaviorId);
        const lp = layerParams(beh, b.param1);
        return {
          behavior: beh?.displayName ?? `#${b.behaviorId}`,
          param1: lp.p1 ? idToIndex.get(b.param1) ?? b.param1 : b.param1,
          param2: lp.p2 ? idToIndex.get(b.param2) ?? b.param2 : b.param2,
        };
      }),
    })),
  };
}

export interface ImportPlan {
  bindings: { layerId: number; keyPosition: number; binding: BehaviorBinding }[];
  names: { layerId: number; name: string }[];
}

/** Work out what to change on the connected keyboard, or throw a readable error. */
export function planImport(raw: unknown, keymap: Keymap, behaviors: Behavior[]): ImportPlan {
  const file = raw as Partial<KeymapFile>;
  if (!file || file.format !== FORMAT || !Array.isArray(file.layers)) {
    throw new Error("このアプリで書き出したキーマップのファイルではありません");
  }
  if (file.layers.length > keymap.layers.length) {
    throw new Error(
      `ファイルのレイヤー数 (${file.layers.length}) が、このキーボードのレイヤー数 (${keymap.layers.length}) より多いため読み込めません`,
    );
  }
  const byName = new Map(behaviors.map((b) => [b.displayName, b]));
  const missing = new Set<string>();
  const plan: ImportPlan = { bindings: [], names: [] };

  file.layers.forEach((fl, i) => {
    const layer = keymap.layers[i];
    if (fl.bindings.length !== layer.bindings.length) {
      throw new Error(
        `レイヤー ${i} のキー数が違います（ファイル ${fl.bindings.length} キー、このキーボード ${layer.bindings.length} キー）。同じ機種のキーボードか確認してください`,
      );
    }
    if (fl.name !== layer.name) plan.names.push({ layerId: layer.id, name: fl.name });
    fl.bindings.forEach((fb, pos) => {
      const beh = byName.get(fb.behavior);
      if (!beh) {
        missing.add(fb.behavior);
        return;
      }
      const lp = layerParams(beh, fb.param1);
      const toId = (idx: number) => keymap.layers[idx]?.id ?? idx;
      const binding: BehaviorBinding = {
        behaviorId: beh.id,
        param1: lp.p1 ? toId(fb.param1) : fb.param1,
        param2: lp.p2 ? toId(fb.param2) : fb.param2,
      };
      const cur = layer.bindings[pos];
      if (cur.behaviorId !== binding.behaviorId || cur.param1 !== binding.param1 || cur.param2 !== binding.param2) {
        plan.bindings.push({ layerId: layer.id, keyPosition: pos, binding });
      }
    });
  });

  if (missing.size) {
    throw new Error(
      `このキーボードのファームウェアにない behavior が使われています: ${[...missing].join("、")}。同じファームウェアを書き込んでから読み込んでください`,
    );
  }
  return plan;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
