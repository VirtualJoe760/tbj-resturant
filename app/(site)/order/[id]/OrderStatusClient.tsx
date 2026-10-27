"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUS_LABEL, type OrderStatus } from "@/domain/orders";
import { money } from "@/domain/pricing";

interface OrderView {
  id: string;
  number: string;
  status: OrderStatus;
  customerName: string;
  pickupAt: string | null;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  lines: { id: string; nameSnapshot: string; quantity: number; lineTotalCents: number; modifiersText: string[] }[];
}

const STEPS: OrderStatus[] = ["paid", "preparing", "ready", "completed"];

export function OrderStatusClient({ initial }: { initial: OrderView }) {
  const [o, setO] = useState(initial);
  useEffect(() => {
    if (["completed", "refunded", "cancelled", "expired"].includes(o.status)) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/orders/${o.id}`, { cache: "no-store" });
      if (r.ok) setO(await r.json());
    }, 3000);
    return () => clearInterval(t);
  }, [o.id, o.status]);

  const step = Math.max(0, STEPS.indexOf(o.status === "accepted" ? "paid" : o.status));
  const pickup = o.pickupAt ? new Date(o.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <>
      <header className="top">
        <h1>{STATUS_LABEL[o.status]}{o.status === "ready" ? " 🎉" : ""}</h1>
        <p>Order #{o.number} · {o.customerName}{pickup ? ` · pickup ~${pickup}` : ""}</p>
      </header>
      <div className="steps">{STEPS.map((s, i) => <div key={s} className={i <= step ? "on" : ""} />)}</div>
      <div className="note">This page updates live — keep it open, or we&apos;ll text you when it&apos;s ready.</div>
      {o.lines.map((l) => (
        <div className="line" key={l.id}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><b>{l.quantity}× {l.nameSnapshot}</b><span>{money(l.lineTotalCents)}</span></div>
          {l.modifiersText.length > 0 && <div className="mods">{l.modifiersText.join(" · ")}</div>}
        </div>
      ))}
      <div className="totals">
        <div><span>Subtotal</span><span>{money(o.subtotalCents)}</span></div>
        <div><span>Tax</span><span>{money(o.taxCents)}</span></div>
        <div><span>Tip</span><span>{money(o.tipCents)}</span></div>
        <div className="grand"><span>Paid</span><span>{money(o.totalCents)}</span></div>
      </div>
      <div className="chips"><Link href="/menu">Back to menu</Link><Link href="/demo/inbox">See receipt email</Link></div>
    </>
  );
}
