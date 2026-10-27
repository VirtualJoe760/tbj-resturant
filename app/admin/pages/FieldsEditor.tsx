"use client";
import { useState } from "react";
import type { FormField } from "@/db/schema";

const TYPES: FormField["type"][] = ["text", "textarea", "email", "tel", "date", "number", "select", "file"];

// Edits the form schema; the parent <form> posts it as JSON in a hidden "fields" input.
export function FieldsEditor({ initial }: { initial: FormField[] }) {
  const [fields, setFields] = useState(initial);
  const set = (i: number, patch: Partial<FormField>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };
  return (
    <>
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      {fields.map((f, i) => (
        <div className="panel" key={f.key + i} style={{ padding: "6px 0" }}>
          <div className="two">
            <label className="field"><span>Label</span><input value={f.label} onChange={(e) => set(i, { label: e.target.value })} /></label>
            <label className="field"><span>Type</span><select value={f.type} onChange={(e) => set(i, { type: e.target.value as FormField["type"] })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
          {f.type === "select" && <label className="field"><span>Options (comma separated)</span><input value={(f.options ?? []).join(", ")} onChange={(e) => set(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>}
          <div className="chips">
            <label className="chk" style={{ margin: 0 }}><input type="checkbox" checked={!!f.required} onChange={(e) => set(i, { required: e.target.checked })} /> Required</label>
            <button type="button" onClick={() => move(i, -1)}>↑</button>
            <button type="button" onClick={() => move(i, 1)}>↓</button>
            <button type="button" onClick={() => setFields(fields.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      <div className="chips"><button type="button" onClick={() => setFields([...fields, { key: `field_${Date.now().toString(36)}`, label: "New question", type: "text" }])}>+ Add field</button></div>
    </>
  );
}
