"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { KITCHEN_FLOW, type OrderStatus } from "@/domain/orders";
import { advanceOrder } from "@/server/actions/admin";

interface Ticket {
  id: string;
  number: string;
  status: OrderStatus;
  channel: string;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  pickupAt: string | null;
  createdAt: string;
  lines: { id: string; nameSnapshot: string; quantity: number; modifiersText: string[]; instructions: string | null }[];
}

const COLS = [
  { key: "new", title: "New" },
  { key: "preparing", title: "Preparing" },
  { key: "ready", title: "Ready" },
] as const;

// Polls every 3 s (works on any tablet, survives flaky Wi-Fi) and beeps on new tickets.
export function KitchenBoard({ initial }: { initial: Ticket[] }) {
  const [tickets, setTickets] = useState(initial);
  const [, start] = useTransition();
  const seen = useRef(new Set(initial.map((t) => t.id)));

  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/kitchen", { cache: "no-store" });
      if (!r.ok) return;
      const next: Ticket[] = await r.json();
      if (next.some((x) => !seen.current.has(x.id))) beep();
      next.forEach((x) => seen.current.add(x.id));
      setTickets(next);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const bump = (t: Ticket) => {
    const flow = KITCHEN_FLOW[t.status];
    if (!flow) return;
    setTickets((all) => (flow.next === "completed" ? all.filter((x) => x.id !== t.id) : all.map((x) => (x.id === t.id ? { ...x, status: flow.next } : x))));
    start(() => advanceOrder(t.id, flow.next));
  };

  return (
    <div className="kds">
      {COLS.map((c) => {
        const list = tickets.filter((t) => KITCHEN_FLOW[t.status]?.column === c.key);
        return (
          <div key={c.key}>
            <h5>{c.title} ({list.length})</h5>
            {list.map((t) => {
              const flow = KITCHEN_FLOW[t.status]!;
              const time = t.pickupAt ? new Date(t.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "ASAP";
              const allergy = t.notes && /allerg/i.test(t.notes);
              return (
                <div key={t.id} className={`ticket ${flow.column}`}>
                  <div className="hd"><span>#{t.number} · {t.channel}</span><span>{time}</span></div>
                  <div>{t.customerName}{t.customerPhone ? ` · ${t.customerPhone}` : ""}</div>
                  {t.lines.map((l) => (
                    <div key={l.id}>
                      <div className="line-item">{l.quantity}× {l.nameSnapshot}</div>
                      {l.modifiersText.map((m) => <div key={m} className={`m ${m.startsWith("NO ") ? "no" : /^(ADD|EXTRA|LIGHT)/.test(m) ? "add" : ""}`}>{m}</div>)}
                      {l.instructions && <div className="m">“{l.instructions}”</div>}
                    </div>
                  ))}
                  {t.notes && <div className="m" style={{ color: allergy ? "var(--bad)" : undefined, fontWeight: 800, marginTop: 6 }}>{allergy ? "⚠ " : ""}{t.notes}</div>}
                  <button onClick={() => bump(t)}>{flow.button}</button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {}
}
