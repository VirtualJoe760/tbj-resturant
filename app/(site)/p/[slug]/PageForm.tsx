"use client";
import { useActionState } from "react";
import type { FormField } from "@/db/schema";
import { submitForm } from "@/server/actions/public";

export function PageForm({ slug, fields, submitLabel }: { slug: string; fields: FormField[]; submitLabel: string }) {
  const [state, action, pending] = useActionState(submitForm.bind(null, slug), null as null | { ok: boolean; message: string });
  if (state?.ok) return <div className="okbox" style={{ margin: 16 }}>✓ {state.message}</div>;
  return (
    <form action={action} className="has-bar">
      {fields.map((f) => (
        <label className="field" key={f.key}>
          <span>{f.label}{f.required ? " *" : ""}</span>
          {f.type === "textarea" ? <textarea name={f.key} rows={3} required={f.required} />
            : f.type === "select" ? (
              <select name={f.key} required={f.required} defaultValue="">
                <option value="" disabled>Choose…</option>
                {f.options?.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : <input name={f.key} type={f.type} required={f.required && f.type !== "file"} />}
        </label>
      ))}
      {/* honeypot: hidden from people, bots fill it */}
      <input name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999 }} aria-hidden />
      {state && !state.ok && <div className="err">{state.message}</div>}
      <div className="bar"><button className="btn center" disabled={pending}>{pending ? "Sending…" : submitLabel}</button></div>
    </form>
  );
}
