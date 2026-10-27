import { desc } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { canTransition, STATUS_LABEL, type OrderStatus } from "@/domain/orders";
import { money } from "@/domain/pricing";
import { refundOrder } from "@/server/actions/admin";

export const metadata = { title: "Orders" };

export default async function Orders() {
  const db = await getDb();
  const [orders, lines] = await Promise.all([db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(50), db.select().from(s.orderItems)]);
  return (
    <>
      <div className="admin-top"><b>Orders &amp; refunds</b><span className="muted small">last {orders.length}</span></div>
      {orders.map((o) => (
        <details className="line" key={o.id}>
          <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span><b>#{o.number}</b> · {o.customerName} <span className="muted small">· {o.channel} · {o.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>
            <span><span className="kind">{STATUS_LABEL[o.status as OrderStatus]}</span> <b>{money(o.totalCents)}</b></span>
          </summary>
          {lines.filter((l) => l.orderId === o.id).map((l) => <div className="mods" key={l.id}>{l.quantity}× {l.nameSnapshot} {l.modifiersText.length ? `(${l.modifiersText.join(", ")})` : ""} — {money(l.lineTotalCents)}</div>)}
          <div className="mods">{o.customerPhone} · {o.customerEmail ?? "no email"} · paid via {o.paymentProvider}</div>
          {canTransition(o.status as OrderStatus, "refunded") && (
            <form action={refundOrder.bind(null, o.id)} style={{ marginTop: 8 }}><button className="ibtn danger">Refund {money(o.totalCents)}</button></form>
          )}
        </details>
      ))}
    </>
  );
}
