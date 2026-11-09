import type { BehaviorParameterValueDescription as Desc } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Behavior, BehaviorBinding, Keymap } from "./device";
import { findSet } from "./bindings";
import { decodeUsage, encodeUsage, MODS, PAGE_CONSUMER, PAGE_KEYBOARD, usageOptions } from "./hid";

export function BindingEditor({
  binding,
  behaviors,
  keymap,
  onChange,
}: {
  binding: BehaviorBinding;
  behaviors: Behavior[];
  keymap: Keymap;
  onChange: (b: BehaviorBinding) => void;
}) {
  const beh = behaviors.find((b) => b.id === binding.behaviorId);
  // param1 choices = union of every metadata set's param1 descriptors
  const p1Descs = beh?.metadata.flatMap((s) => s.param1) ?? [];
  const set = beh ? findSet(beh, binding.param1) : undefined;
  const p2Descs = set?.param2 ?? [];

  const pickBehavior = (id: number) => {
    const nb = behaviors.find((b) => b.id === id);
    const first = nb?.metadata[0];
    onChange({
      behaviorId: id,
      param1: defaultValue(first?.param1, keymap),
      param2: defaultValue(first?.param2, keymap),
    });
  };

  return (
    <div className="editor">
      <label>
        <span>Behavior</span>
        <select value={binding.behaviorId} onChange={(e) => pickBehavior(Number(e.target.value))}>
          {!beh && <option value={binding.behaviorId}>不明 (#{binding.behaviorId})</option>}
          {[...behaviors]
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((b) => (
              <option key={b.id} value={b.id}>{b.displayName}</option>
            ))}
        </select>
      </label>
      {p1Descs.length > 0 && (
        <ParamInput
          descs={p1Descs}
          value={binding.param1}
          keymap={keymap}
          onChange={(v) => {
            const s = beh ? findSet(beh, v) : undefined;
            const keepP2 = s === set;
            onChange({ ...binding, param1: v, param2: keepP2 ? binding.param2 : defaultValue(s?.param2, keymap) });
          }}
        />
      )}
      {p2Descs.length > 0 && (
        <ParamInput
          descs={p2Descs}
          value={binding.param2}
          keymap={keymap}
          onChange={(v) => onChange({ ...binding, param2: v })}
        />
      )}
    </div>
  );
}

function defaultValue(descs: Desc[] | undefined, keymap: Keymap): number {
  const d = descs?.[0];
  if (!d) return 0;
  if (d.constant !== undefined) return d.constant;
  if (d.range) return d.range.min;
  if (d.layerId) return keymap.layers[0]?.id ?? 0;
  if (d.hidUsage) return encodeUsage(PAGE_KEYBOARD, 0x04);
  return 0;
}

function ParamInput({
  descs,
  value,
  keymap,
  onChange,
}: {
  descs: Desc[];
  value: number;
  keymap: Keymap;
  onChange: (v: number) => void;
}) {
  // A mix of constants (e.g. BT_CLR / BT_SEL) → one select
  const constants = descs.filter((d) => d.constant !== undefined);
  const other = descs.find((d) => d.constant === undefined);
  const name = descs.length === 1 || !constants.length ? descs[0].name : "Command";

  if (constants.length && !other) {
    return (
      <label>
        <span>{name}</span>
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {constants.map((d) => (
            <option key={d.constant} value={d.constant}>{d.name}</option>
          ))}
        </select>
      </label>
    );
  }
  const d = other!;
  if (d.layerId) {
    return (
      <label>
        <span>{d.name}</span>
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {keymap.layers.map((l, i) => (
            <option key={l.id} value={l.id}>{i}: {l.name || `Layer ${i}`}</option>
          ))}
        </select>
      </label>
    );
  }
  if (d.range) {
    return (
      <label>
        <span>{d.name} ({d.range.min}–{d.range.max})</span>
        <input
          type="number"
          min={d.range.min}
          max={d.range.max}
          value={value}
          onChange={(e) => onChange(Math.min(d.range!.max, Math.max(d.range!.min, Number(e.target.value))))}
        />
      </label>
    );
  }
  if (d.hidUsage) return <HidInput name={d.name} max={d.hidUsage} value={value} onChange={onChange} />;
  return null;
}

function HidInput({
  name,
  max,
  value,
  onChange,
}: {
  name: string;
  max: { keyboardMax: number; consumerMax: number };
  value: number;
  onChange: (v: number) => void;
}) {
  const { mods, page, id } = decodeUsage(value);
  const pages = [
    { page: PAGE_KEYBOARD, label: "キーボード", max: max.keyboardMax },
    { page: PAGE_CONSUMER, label: "メディア", max: max.consumerMax },
  ].filter((p) => p.max > 0);
  const opts = usageOptions(page, pages.find((p) => p.page === page)?.max ?? 0xffff);

  return (
    <fieldset className="hid">
      <legend>{name}</legend>
      {pages.length > 1 && (
        <div className="seg">
          {pages.map((p) => (
            <button
              key={p.page}
              className={p.page === page ? "on" : ""}
              onClick={() => onChange(encodeUsage(p.page, usageOptions(p.page, p.max)[0]?.id ?? 0, 0))}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <select value={id} onChange={(e) => onChange(encodeUsage(page, Number(e.target.value), mods))}>
        {!opts.some((o) => o.id === id) && <option value={id}>0x{id.toString(16)}</option>}
        {opts.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {page === PAGE_KEYBOARD && (
        <div className="mods">
          {MODS.map((m) => (
            <label key={m.bit} className="chk">
              <input
                type="checkbox"
                checked={!!(mods & m.bit)}
                onChange={() => onChange(encodeUsage(page, id, mods ^ m.bit))}
              />
              {m.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
