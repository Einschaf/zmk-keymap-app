import {
  create_rpc_connection,
  call_rpc,
  type RpcConnection,
  type Notification,
} from "@zmkfirmware/zmk-studio-ts-client";
import { connect as connectSerial } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import { connect as connectGatt } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type {
  BehaviorBinding,
  Keymap,
  PhysicalLayouts,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { createMockDevice } from "./mock";

export type Behavior = GetBehaviorDetailsResponse;
export type { BehaviorBinding, Keymap, PhysicalLayouts };
export { LockState };

/** The operations the UI needs; implemented for real hardware and for the demo. */
export interface Device {
  label: string;
  getDeviceName(): Promise<string>;
  getLockState(): Promise<LockState>;
  getBehaviors(): Promise<Behavior[]>;
  getKeymap(): Promise<Keymap>;
  getPhysicalLayouts(): Promise<PhysicalLayouts>;
  setBinding(layerId: number, keyPosition: number, b: BehaviorBinding): Promise<string | null>;
  setLayerName(layerId: number, name: string): Promise<boolean>;
  checkUnsaved(): Promise<boolean>;
  save(): Promise<string | null>;
  discard(): Promise<boolean>;
  /** Erase every change saved from Studio so the keyboard uses the keymap built into its firmware. */
  resetToFirmware(): Promise<boolean>;
  onNotification(cb: (n: Notification) => void): void;
  disconnect(): void;
}

export type TransportKind = "serial" | "ble" | "demo";

export function isSupported(kind: TransportKind): boolean {
  if (kind === "serial") return "serial" in navigator;
  if (kind === "ble") return "bluetooth" in navigator;
  return true;
}

export async function connectDevice(kind: TransportKind): Promise<Device> {
  if (kind === "demo") return createMockDevice();
  const transport = kind === "serial" ? await connectSerial() : await connectGatt();
  const conn = create_rpc_connection(transport);
  return wrap(conn, transport.abortController);
}

const SET_BINDING_ERRORS: Record<number, string> = {
  1: "キー位置が不正です",
  2: "behavior が不正です",
  3: "パラメータが不正です",
};
const SAVE_ERRORS: Record<number, string> = {
  1: "保存に失敗しました",
  2: "このキーボードは保存に対応していません",
  3: "保存領域が足りません",
};

function wrap(conn: RpcConnection, abort: AbortController): Device {
  const listeners: ((n: Notification) => void)[] = [];
  (async () => {
    const reader = conn.notification_readable.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        listeners.forEach((l) => l(value));
      }
    } catch {
      /* connection closed */
    }
  })();

  const rpc = (req: Parameters<typeof call_rpc>[1]) => call_rpc(conn, req);

  return {
    label: conn.label,
    async getDeviceName() {
      const r = await rpc({ core: { getDeviceInfo: true } });
      return r.core?.getDeviceInfo?.name ?? "Unknown";
    },
    async getLockState() {
      const r = await rpc({ core: { getLockState: true } });
      return r.core?.getLockState ?? LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED;
    },
    async getBehaviors() {
      const list = await rpc({ behaviors: { listAllBehaviors: true } });
      const ids = list.behaviors?.listAllBehaviors?.behaviors ?? [];
      const out: Behavior[] = [];
      for (const behaviorId of ids) {
        const d = await rpc({ behaviors: { getBehaviorDetails: { behaviorId } } });
        if (d.behaviors?.getBehaviorDetails) out.push(d.behaviors.getBehaviorDetails);
      }
      return out;
    },
    async getKeymap() {
      const r = await rpc({ keymap: { getKeymap: true } });
      if (!r.keymap?.getKeymap) throw new Error("キーマップを取得できませんでした");
      return r.keymap.getKeymap;
    },
    async getPhysicalLayouts() {
      const r = await rpc({ keymap: { getPhysicalLayouts: true } });
      if (!r.keymap?.getPhysicalLayouts) throw new Error("物理レイアウトを取得できませんでした");
      return r.keymap.getPhysicalLayouts;
    },
    async setBinding(layerId, keyPosition, binding) {
      const r = await rpc({ keymap: { setLayerBinding: { layerId, keyPosition, binding } } });
      const code = r.keymap?.setLayerBinding ?? 0;
      return code === 0 ? null : SET_BINDING_ERRORS[code] ?? `エラー (${code})`;
    },
    async setLayerName(layerId, name) {
      const r = await rpc({ keymap: { setLayerProps: { layerId, name } } });
      return (r.keymap?.setLayerProps ?? 0) === 0;
    },
    async checkUnsaved() {
      const r = await rpc({ keymap: { checkUnsavedChanges: true } });
      return !!r.keymap?.checkUnsavedChanges;
    },
    async save() {
      const r = await rpc({ keymap: { saveChanges: true } });
      const s = r.keymap?.saveChanges;
      if (s?.ok) return null;
      return SAVE_ERRORS[s?.err ?? 1] ?? "保存に失敗しました";
    },
    async resetToFirmware() {
      const r = await rpc({ core: { resetSettings: true } });
      return !!r.core?.resetSettings;
    },
    async discard() {
      const r = await rpc({ keymap: { discardChanges: true } });
      return !!r.keymap?.discardChanges;
    },
    onNotification(cb) {
      listeners.push(cb);
    },
    disconnect() {
      abort.abort("user disconnect");
    },
  };
}
