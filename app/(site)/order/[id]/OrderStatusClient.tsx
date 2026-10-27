"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUS_LABEL, type OrderStatus } from "@/domain/orders";
import { COURIER_DONE, COURIER_LABEL, type DeliveryAddress, type DeliveryRecord } from "@/domain/delivery";
import { money } from "@/domain/pricing";
import { trackOrder } from "@/components/alerts-store";
import { PushOptIn } from "@/components/PushOptIn";

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
  fulfillment: "pickup" | "delivery";
  deliveryAddress: DeliveryAddress | null;
  deliveryFeeCents: number;
  delivery: DeliveryRecord | null;
  lines: { id: string; nameSnapshot: string; quantity: number; lineTotalCents: number; modifiersText: string[] }[];
}

const PICKUP_STEPS = [["Received", ["paid", "accepted"]], ["Being made", ["preparing"]], ["Ready", ["ready"]], ["Picked up", ["completed"]]] as const;
const DELIVERY_STEPS = ["Received", "Being made", "On the way", "Delivered"];
const FINAL = ["completed", "refunded", "cancelled", "expired"];

/** Where a delivery order is: 0 received, 1 being made, 2 on the way, 3 delivered. */
function deliveryStep(o: OrderView) {
  const c = o.delivery?.status;
  if (c === "delivered") return 3;
  if (c === "picked_up" || c === "at_dropoff") return 2;
  if (o.status === "preparing" || o.status === "ready") return 1;
  return 0;
}

function headline(o: OrderView) {
  if (o.fulfillment !== "delivery") return STATUS_LABEL[o.status] + (o.status === "ready" ? " 🎉" : "");
  const c = o.delivery?.status;
  if (c && ["picked_up", "at_dropoff", "delivered", "failed", "cancelled"].includes(c)) return COURIER_LABEL[c] + (c === "delivered" ? " 🎉" : "");
  if (o.status === "preparing") return "Being made";
  if (o.status === "ready") return "Ready · waiting for the driver";
  return STATUS_LABEL[o.status];
}

export function OrderStatusClient({ initial }: { initial: OrderView }) {
  const [o, setO] = useState(initial);
  const delivery = o.fulfillment === "delivery";
  const live = !FINAL.includes(o.status) || (delivery && o.delivery && !COURIER_DONE.includes(o.delivery.status));

  useEffect(() => trackOrder(o.id), [o.id]); // this phone follows the order (site-wide alerts)
  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/orders/${o.id}`, { cache: "no-store" });
      if (r.ok) setO(await r.json());
    }, 4000);
    return () => clearInterval(t);
  }, [o.id, live]);

  const steps = delivery ? DELIVERY_STEPS : PICKUP_STEPS.map(([l]) => l);
  const step = delivery ? deliveryStep(o) : Math.max(0, PICKUP_STEPS.findIndex(([, ss]) => (ss as readonly string[]).includes(o.status)));
  const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
  const d = o.delivery;

  return (
    <>
      <header className="top">
        <h1>{headline(o)}</h1>
        <p>Order #{o.number} · {o.customerName}{delivery ? (d?.dropoffEta && !COURIER_DONE.includes(d.status) ? ` · arrives ~${time(d.dropoffEta)}` : "") : o.pickupAt ? ` · pickup ~${time(o.pickupAt)}` : ""}</p>
      </header>
      <div className="steps labeled">
        {steps.map((label, i) => <div key={label} className={i <= step ? "on" : ""}><span>{label}</span></div>)}
      </div>

      {delivery && (
        <div className="card">
          <b>🚗 Delivery{o.deliveryAddress ? ` to ${o.deliveryAddress.street}${o.deliveryAddress.unit ? ` ${o.deliveryAddress.unit}` : ""}` : ""}</b>
          <div className="mods">
            {!d ? (o.status === "pending_payment" ? "We'll book a driver once payment goes through." : "Booking a driver…")
              : d.status === "failed" ? "We couldn't book a driver. The restaurant will call you."
              : `${COURIER_LABEL[d.status]}${d.courierName ? ` · ${d.courierName}` : ""}`}
          </div>
          {d?.trackingUrl && !COURIER_DONE.includes(d.status) && <div className="chips" style={{ margin: "10px 0 0" }}><a href={d.trackingUrl} target="_blank" rel="noreferrer">Track the driver on the map →</a></div>}
        </div>
      )}

      {live && <PushOptIn orderId={o.id} label={delivery ? "Notify me when it's started and on the way" : "Notify me when it's started and ready"} />}
      {live && <div className="note">This page updates live. You&apos;ll also see a pop-up anywhere on the site when the kitchen starts and finishes your order.</div>}

      {o.lines.map((l) => (
        <div className="line" key={l.id}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><b>{l.quantity}× {l.nameSnapshot}</b><span>{money(l.lineTotalCents)}</span></div>
          {l.modifiersText.length > 0 && <div className="mods">{l.modifiersText.join(" · ")}</div>}
        </div>
      ))}
      <div className="totals">
        <div><span>Subtotal</span><span>{money(o.subtotalCents)}</span></div>
        <div><span>Tax</span><span>{money(o.taxCents)}</span></div>
        {delivery && <div><span>Delivery</span><span>{money(o.deliveryFeeCents)}</span></div>}
        <div><span>{delivery ? "Driver tip" : "Tip"}</span><span>{money(o.tipCents)}</span></div>
        <div className="grand"><span>Paid</span><span>{money(o.totalCents)}</span></div>
      </div>
      <div className="chips"><Link href="/menu">Back to menu</Link><Link href="/account">Your orders</Link><Link href="/demo/inbox">See receipt email</Link></div>
    </>
  );
}
