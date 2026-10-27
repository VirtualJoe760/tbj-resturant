import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { canTransition, type OrderStatus } from "@/domain/orders";
import { receiptEmail, sendEmail, simpleEmail } from "@/server/email";
import { notifyOrder } from "@/server/notify";

/** The single place an order becomes paid (Stripe webhook or demo payment). */
export async function markPaid(orderId: string) {
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
  if (!o || o.status !== "pending_payment") return;
  await db.update(s.orders).set({ status: "paid" }).where(eq(s.orders.id, orderId));
  await db.insert(s.orderEvents).values({ orderId, fromStatus: o.status, toStatus: "paid" });
  const lines = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
  if (o.customerEmail) await sendEmail(db, { to: o.customerEmail, subject: `Receipt · order #${o.number}`, kind: "receipt", html: receiptEmail(o, lines) });
  if (o.fulfillment === "delivery") {
    const { bookDelivery } = await import("@/server/delivery-service"); // loaded lazily: it imports this file
    await bookDelivery(orderId);
  }
}

/** Moves an order along the state machine and records who did it. */
export async function transitionOrder(orderId: string, to: OrderStatus, actorUserId?: string) {
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
  if (!o) throw new Error("Order not found");
  if (!canTransition(o.status as OrderStatus, to)) throw new Error(`Can't go from ${o.status} to ${to}`);
  await db.update(s.orders).set({ status: to }).where(eq(s.orders.id, orderId));
  await db.insert(s.orderEvents).values({ orderId, fromStatus: o.status, toStatus: to, actorUserId: actorUserId ?? null });
  // the customer's dashboard + phone: "We started your order", "Ready for pickup"
  if (to === "preparing") await notifyOrder(orderId, "started");
  if (to === "ready") await notifyOrder(orderId, "ready");
  if (to === "ready" && o.customerEmail && o.fulfillment === "pickup")
    await sendEmail(db, { to: o.customerEmail, subject: `Order #${o.number} is ready`, kind: "ready", html: simpleEmail(`<p>Your order <b>#${o.number}</b> is ready for pickup. See you soon!</p>`) });
  if (to === "refunded" && o.customerEmail)
    await sendEmail(db, { to: o.customerEmail, subject: `Refund for order #${o.number}`, kind: "refund", html: simpleEmail(`<p>We've refunded order <b>#${o.number}</b>. It can take 5–10 days to show on your statement.</p>`) });
}
