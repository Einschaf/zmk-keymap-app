import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectDevice,
  isSupported,
  LockState,
  type Behavior,
  type BehaviorBinding,
  type Device,
  type Keymap,
  type PhysicalLayouts,
  type TransportKind,
} from "./device";
import { Keyboard } from "./Keyboard";
import { BindingEditor } from "./BindingEditor";
import { bindingLabel } from "./bindings";
import { HostLayoutContext, useHostLayoutState } from "./layout";
import "./App.css";

type State =
  | { phase: "idle" }
  | { phase: "connecting" }
  | { phase: "locked"; dev: Device; name: string }
  | { phase: "ready"; dev: Device; name: string };

export default function App() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [keymap, setKeymap] = useState<Keymap | null>(null);
  const [layouts, setLayouts] = useState<PhysicalLayouts | null>(null);
  const [layerIdx, setLayerIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hostLayout, setHostLayout] = useHostLayoutState();

  const dev = state.phase === "ready" || state.phase === "locked" ? state.dev : null;

  const loadAll = useCallback(async (d: Device, name: string) => {
    const [b, km, pl, u] = [
      await d.getBehaviors(),
      await d.getKeymap(),
      await d.getPhysicalLayouts(),
      await d.checkUnsaved(),
    ];
    setBehaviors(b);
    setKeymap(km);
    setLayouts(pl);
    setUnsaved(u);
    setState({ phase: "ready", dev: d, name });
  }, []);

  const connect = async (kind: TransportKind) => {
    setError(null);
    setState({ phase: "connecting" });
    try {
      const d = await connectDevice(kind);
      const name = await d.getDeviceName();
      d.onNotification((n) => {
        if (n.keymap?.unsavedChangesStatusChanged !== undefined)
          setUnsaved(n.keymap.unsavedChangesStatusChanged);
        if (n.core?.lockStateChanged === LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED)
          loadAll(d, name).catch((e) => setError(String(e)));
        if (n.core?.lockStateChanged === LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED)
          setState({ phase: "locked", dev: d, name });
      });
      if ((await d.getLockState()) === LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED) {
        setState({ phase: "locked", dev: d, name });
      } else {
        await loadAll(d, name);
      }
    } catch (e) {
      setState({ phase: "idle" });
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|No port selected|User cancelled/i.test(msg)) setError(`接続に失敗しました: ${msg}`);
    }
  };

  const disconnect = () => {
    dev?.disconnect();
    setState({ phase: "idle" });
    setKeymap(null);
    setLayouts(null);
    setSelected(null);
    setLayerIdx(0);
  };

  const behaviorMap = useMemo(() => new Map(behaviors.map((b) => [b.id, b])), [behaviors]);
  const layer = keymap?.layers[layerIdx];
  const physical = layouts?.layouts[layouts.activeLayoutIndex];
  const labels = useMemo(
    () => (layer && keymap ? layer.bindings.map((b) => bindingLabel(b, behaviorMap, keymap, hostLayout)) : []),
    [layer, keymap, behaviorMap, hostLayout],
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateBinding = (b: BehaviorBinding) =>
    run(async () => {
      if (!dev || !layer || selected === null) return;
      const err = await dev.setBinding(layer.id, selected, b);
      if (err) throw new Error(err);
      setKeymap((km) =>
        km && {
          ...km,
          layers: km.layers.map((l) =>
            l.id === layer.id ? { ...l, bindings: l.bindings.map((x, i) => (i === selected ? b : x)) } : l,
          ),
        },
      );
      setUnsaved(true);
    });

  const [renaming, setRenaming] = useState<number | null>(null); // layer id being renamed
  const [draftName, setDraftName] = useState("");
  const cancelRename = useRef(false);

  const startRename = (layerId: number) => {
    const l = keymap?.layers.find((x) => x.id === layerId);
    if (!l) return;
    cancelRename.current = false;
    setDraftName(l.name);
    setRenaming(layerId);
  };

  const commitRename = () =>
    run(async () => {
      const layerId = renaming;
      setRenaming(null);
      if (cancelRename.current) return;
      if (!dev || !keymap || layerId === null) return;
      const name = truncateUtf8(draftName.trim(), keymap.maxLayerNameLength);
      const current = keymap.layers.find((l) => l.id === layerId);
      if (!current || name === current.name) return;
      if (!(await dev.setLayerName(layerId, name))) throw new Error("レイヤー名を変更できませんでした");
      setKeymap((km) => km && { ...km, layers: km.layers.map((l) => (l.id === layerId ? { ...l, name } : l)) });
      setUnsaved(true);
    });

  const save = () =>
    run(async () => {
      const err = await dev!.save();
      if (err) throw new Error(err);
      setUnsaved(await dev!.checkUnsaved());
    });

  const discard = () =>
    run(async () => {
      if (!confirm("保存していない変更をすべて破棄しますか？")) return;
      await dev!.discard();
      setKeymap(await dev!.getKeymap());
      setUnsaved(false);
    });

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (unsaved) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  const deviceName = state.phase === "ready" || state.phase === "locked" ? state.name : "";
  const selectedLabel = selected !== null ? labels[selected] : undefined;

  return (
    <HostLayoutContext.Provider value={hostLayout}>
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>⌨</span>
          <span>ZMK Keymap Editor</span>
        </div>
        {dev && (
          <div className="device-chip" title={dev.label}>
            <span className="dot" />
            <span className="device-name">{deviceName}</span>
            <span className="transport">{dev.label}</span>
          </div>
        )}
        <div className="topbar-actions">
          <div className="host-layout" role="group" aria-label="PC のキー配列">
            <span className="muted small">PC の配列</span>
            <div className="seg">
              {(["jis", "us"] as const).map((l) => (
                <button key={l} className={hostLayout === l ? "on" : ""} onClick={() => setHostLayout(l)} aria-pressed={hostLayout === l}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {state.phase === "ready" && (
            <>
              <span className={`save-state${unsaved ? " dirty" : ""}`}>
                {unsaved ? "● 未保存の変更あり" : "✓ 保存済み"}
              </span>
              <button className="btn ghost" disabled={!unsaved || busy} onClick={discard}>破棄</button>
              <button className="btn primary" disabled={!unsaved || busy} onClick={save}>キーボードに保存</button>
            </>
          )}
          {dev && <button className="btn ghost" onClick={disconnect}>切断</button>}
        </div>
      </header>

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button className="icon-btn" onClick={() => setError(null)} aria-label="閉じる">×</button>
        </div>
      )}

      {(state.phase === "idle" || state.phase === "connecting") && (
        <div className="center-stage">
          <div className="welcome">
            <div className="welcome-icon" aria-hidden>⌨</div>
            <h1>キーボードを接続</h1>
            <p className="muted">ZMK Studio 対応ファームウェアのキーボードのキーマップを、その場で書き換えられます。</p>
            <div className="connect-options">
              <button className="connect-card" disabled={!isSupported("serial") || state.phase === "connecting"} onClick={() => connect("serial")}>
                <span className="cc-icon" aria-hidden>🔌</span>
                <span className="cc-title">USB</span>
                <span className="cc-desc">ケーブルでつなぐ</span>
              </button>
              <button className="connect-card" disabled={!isSupported("ble") || state.phase === "connecting"} onClick={() => connect("ble")}>
                <span className="cc-icon" aria-hidden>📶</span>
                <span className="cc-title">Bluetooth</span>
                <span className="cc-desc">ワイヤレスでつなぐ</span>
              </button>
              <button className="connect-card" disabled={state.phase === "connecting"} onClick={() => connect("demo")}>
                <span className="cc-icon" aria-hidden>🧪</span>
                <span className="cc-title">デモ</span>
                <span className="cc-desc">キーボードなしで試す</span>
              </button>
            </div>
            {state.phase === "connecting" && <p className="muted"><span className="spinner" /> 接続しています…</p>}
            {(!isSupported("serial") || !isSupported("ble")) && (
              <p className="muted small">USB／Bluetooth 接続は Chrome や Edge などの Chromium 系ブラウザで使えます。</p>
            )}
          </div>
        </div>
      )}

      {state.phase === "locked" && (
        <div className="center-stage">
          <div className="welcome">
            <div className="welcome-icon" aria-hidden>🔒</div>
            <h1>キーボードがロックされています</h1>
            <p className="muted">
              <code>&amp;studio_unlock</code> を割り当てたキーを押してください。アンロックすると自動で読み込みます。
            </p>
          </div>
        </div>
      )}

      {state.phase === "ready" && keymap && physical && layer && (
        <div className="workspace">
          <nav className="layerbar" aria-label="レイヤー">
            <ul className="layer-tabs">
              {keymap.layers.map((l, i) => (
                <li key={l.id}>
                  {renaming === l.id ? (
                    <div className="layer-tab editing">
                      <span className="layer-idx">{i}</span>
                      <input
                        className="layer-input"
                        autoFocus
                        value={draftName}
                        placeholder={`Layer ${i}`}
                        aria-label={`レイヤー ${i} の名前`}
                        onChange={(e) => setDraftName(truncateUtf8(e.target.value, keymap.maxLayerNameLength))}
                        onFocus={(e) => e.target.select()}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") {
                            cancelRename.current = true;
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`layer-tab${i === layerIdx ? " active" : ""}`}>
                      <button
                        className="layer-select"
                        onClick={() => setLayerIdx(i)}
                        onDoubleClick={() => startRename(l.id)}
                        aria-current={i === layerIdx}
                      >
                        <span className="layer-idx">{i}</span>
                        <span className="layer-name">{l.name || `Layer ${i}`}</span>
                      </button>
                      <button
                        className="icon-btn layer-edit"
                        disabled={busy || renaming !== null}
                        onClick={() => startRename(l.id)}
                        title="名前を変更"
                        aria-label={`レイヤー ${i} の名前を変更`}
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <span className="layerbar-meta muted small">
              {physical.keys.length} キー · {physical.name}
            </span>
          </nav>

          <section className="canvas" aria-label={`${layer.name || `Layer ${layerIdx}`} のキー配置`}>
            <Keyboard layout={physical} labels={labels} selected={selected} onSelect={setSelected} />
          </section>

          <section className="inspector" aria-label="キーの設定">
            {selected === null || !layer.bindings[selected] ? (
              <div className="empty">
                <div className="empty-key" aria-hidden />
                <div>
                  <p>キーを選択してください</p>
                  <p className="muted small">
                    上のキーボードでキーをクリックすると、ここで割り当てを変更できます。レイヤー名は ✎ かタブのダブルクリックで変更できます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="inspector-body">
                <div className="inspector-head">
                  <div className="preview-key">
                    {selectedLabel?.sub && <span className="sub">{selectedLabel.sub}</span>}
                    <span className="main">{selectedLabel?.main || "—"}</span>
                  </div>
                  <div className="inspector-meta">
                    <div className="inspector-title">キー {selected}</div>
                    <div className="muted small">{layer.name || `Layer ${layerIdx}`}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setSelected(null)} aria-label="選択を解除">×</button>
                </div>
                <BindingEditor
                  binding={layer.bindings[selected]}
                  behaviors={behaviors}
                  keymap={keymap}
                  onChange={updateBinding}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
    </HostLayoutContext.Provider>
  );
}

/** The firmware limits layer names in bytes (UTF-8), so a Japanese character counts as 3. */
function truncateUtf8(s: string, maxBytes: number): string {
  const enc = new TextEncoder();
  let out = "";
  for (const ch of s) {
    if (enc.encode(out + ch).length > maxBytes) break;
    out += ch;
  }
  return out;
}
