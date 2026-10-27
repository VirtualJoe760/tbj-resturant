"use client";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "@/components/Toast";
import { sendDepositLink, setRequestStatus } from "@/server/actions/admin";

export function RequestActions({ id, status, steps, kind, email }: { id: string; status: string; steps: string[]; kind: string; email: string | null }) {
  const [pending, start] = useTransition();
  return (
    <>
      <div className="chips" style={{ margin: "10px 0 0" }}>
        {steps.map((st) => (
          <button key={st} className={status === st ? "on" : ""} disabled={pending} onClick={() => start(() => setRequestStatus(id, st))}>{st}</button>
        ))}
      </div>
      <div className="chips" style={{ margin: "6px 0 0" }}>
        {email && <a href={`mailto:${email}`}>✉️ Reply</a>}
        {(kind === "private" || kind === "catering") && (
          <button disabled={pending} onClick={() => {
            const amt = Number(prompt("Deposit amount ($)", "200"));
            if (amt > 0) start(async () => { const r = await sendDepositLink(id, amt); toast(r?.message ?? "Sent"); });
          }}>💵 Send deposit link</button>
        )}
        {kind === "band" && <Link href="/admin/events">📅 Add to events</Link>}
        {kind === "jobs" && <Link href="/admin/team">👥 Send staff invite</Link>}
      </div>
    </>
  );
}
