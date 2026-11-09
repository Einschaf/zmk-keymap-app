import { useCallback, useEffect, useMemo, useState } from "react";
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
    () => (layer && keymap ? layer.bindings.map((b) => bindingLabel(b, behaviorMap, keymap)) : []),
    [layer, keymap, behaviorMap],
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

  const renameLayer = () =>
    run(async () => {
      if (!dev || !layer || !keymap) return;
      const name = prompt("レイヤー名", layer.name)?.slice(0, keymap.maxLayerNameLength);
      if (name == null) return;
      if (!(await dev.setLayerName(layer.id, name))) throw new Error("レイヤー名を変更できませんでした");
      setKeymap({ ...keymap, layers: keymap.layers.map((l) => (l.id === layer.id ? { ...l, name } : l)) });
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

  return (
    <div className="app">
      <header>
        <h1>ZMK Keymap Editor</h1>
        {dev && (
          <div className="device">
            <span className="dot" />
            {state.phase !== "idle" && "name" in state ? state.name : ""}
            <small>({dev.label})</small>
            <button onClick={disconnect}>切断</button>
          </div>
        )}
      </header>

      {error && <div className="error" onClick={() => setError(null)}>{error}</div>}

      {(state.phase === "idle" || state.phase === "connecting") && (
        <section className="connect">
          <p>ZMK Studio 対応ファームウェアのキーボードを接続してください。</p>
          <div className="buttons">
            <button disabled={!isSupported("serial") || state.phase === "connecting"} onClick={() => connect("serial")}>
              USB で接続
            </button>
            <button disabled={!isSupported("ble") || state.phase === "connecting"} onClick={() => connect("ble")}>
              Bluetooth で接続
            </button>
            <button className="ghost" disabled={state.phase === "connecting"} onClick={() => connect("demo")}>
              デモで試す
            </button>
          </div>
          {(!isSupported("serial") || !isSupported("ble")) && (
            <p className="hint">USB／Bluetooth 接続は Chrome や Edge などの Chromium 系ブラウザで使えます。</p>
          )}
          {state.phase === "connecting" && <p className="hint">接続しています…</p>}
        </section>
      )}

      {state.phase === "locked" && (
        <section className="connect">
          <h2>🔒 キーボードがロックされています</h2>
          <p>
            キーマップの <code>&amp;studio_unlock</code> を割り当てたキーを押してアンロックしてください。
            アンロックすると自動で読み込みます。
          </p>
        </section>
      )}

      {state.phase === "ready" && keymap && physical && layer && (
        <main>
          <div className="toolbar">
            <div className="tabs">
              {keymap.layers.map((l, i) => (
                <button
                  key={l.id}
                  className={i === layerIdx ? "on" : ""}
                  onClick={() => setLayerIdx(i)}
                  onDoubleClick={renameLayer}
                >
                  {i}: {l.name || `Layer ${i}`}
                </button>
              ))}
            </div>
            <div className="actions">
              {unsaved && <span className="badge">未保存の変更あり</span>}
              <button className="ghost" disabled={!unsaved || busy} onClick={discard}>破棄</button>
              <button disabled={!unsaved || busy} onClick={save}>キーボードに保存</button>
            </div>
          </div>

          <Keyboard layout={physical} labels={labels} selected={selected} onSelect={setSelected} />

          <aside className="panel">
            {selected === null ? (
              <p className="hint">変更したいキーをクリックしてください。レイヤー名はタブをダブルクリックすると変更できます。</p>
            ) : layer.bindings[selected] ? (
              <>
                <h3>キー {selected} <small>({layer.name || `Layer ${layerIdx}`})</small></h3>
                <BindingEditor
                  binding={layer.bindings[selected]}
                  behaviors={behaviors}
                  keymap={keymap}
                  onChange={updateBinding}
                />
              </>
            ) : null}
          </aside>
        </main>
      )}
    </div>
  );
}
