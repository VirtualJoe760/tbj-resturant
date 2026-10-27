"use client";
import { useActionState } from "react";
import { subscribe } from "@/server/actions/public";

export function NewsletterSignup() {
  const [state, action, pending] = useActionState(subscribe, null as null | { ok: boolean; message: string });
  return (
    <form action={action} className="card">
      <b>Deals, events &amp; new pizzas</b>
      <div className="mods">One email a week, tops. Unsubscribe anytime.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input name="email" type="email" required placeholder="you@example.com" style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--line)", font: "inherit", minWidth: 0 }} />
        <button className="ibtn primary" disabled={pending}>Join</button>
      </div>
      {state && <div className={state.ok ? "okbox" : "warnbox"}>{state.message}</div>}
    </form>
  );
}
