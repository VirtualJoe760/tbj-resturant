import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { restaurant } from "@/config/restaurant";
import { COURIER_DONE, parseOneLine, type DeliveryAddress, type DeliveryRecord } from "@/domain/delivery";
import { ALERT_COURIER } from "@/domain/order-alerts";
import { canTransition, type OrderStatus } from "@/domain/orders";
import { DeliveryError, getDeliveryProvider, providerByName, type Pickup } from "@/delivery/provider";
import { LOCATION_ID } from "@/server/queries";
import { notifyOrder } from "@/server/notify";
import { transitionOrder } from "@/server/order-service";

// Quote at checkout → book the driver once the order is paid → keep the trip status fresh while
// someone is looking (order page, kitchen screen, dashboard). Polling, so no webhooks to set up.

export interface StoredQuote {
  provider: DeliveryRecord["provider"];
  quoteId: string;
  ref: string;
  customerFeeCents: number;
  providerFeeCents: number;
  etaMinutes: number;
  address: DeliveryAddress;
  expiresAt: string;
}

async function pickup(): Promise<Pickup> {
  const db = await getDb();
  const loc = await db.query.locations.findFirst({ where: eq(s.locations.id, LOCATION_ID) });
  const address = parseOneLine(loc?.address ?? restaurant.address);
  if (!address) throw new DeliveryError("The restaurant's address isn't set up for delivery yet.");
  return { name: restaurant.name, phone: loc?.phone ?? restaurant.phone, address };
}

/** Price and time for a delivery to `address`. The customer's fee follows restaurant.delivery.customerFee. */
export async function quoteDelivery(input: { address: DeliveryAddress; subtotalCents: number; name: string; phone: string }) {
  const cfg = restaurant.delivery;
  const provider = getDeliveryProvider();
  if (!cfg?.enabled || !provider) throw new DeliveryError("Delivery isn't available right now.");
  const db = await getDb();
  const loc = await db.query.locations.findFirst({ where: eq(s.locations.id, LOCATION_ID) });
  if (loc?.deliveryPaused) throw new DeliveryError("Delivery is paused right now. Pickup is still open.");
  if (input.subtotalCents < cfg.minOrderCents) throw new DeliveryError(`Delivery needs a $${(cfg.minOrderCents / 100).toFixed(0)} minimum order.`);
  const ref = `${restaurant.slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const q = await provider.quote({ ref, pickup: await pickup(), dropoff: input.address, customerName: input.name || "Customer", customerPhone: input.phone || "0000000000", subtotalCents: input.subtotalCents });
  const stored: StoredQuote = {
    provider: provider.name, quoteId: q.quoteId, ref, providerFeeCents: q.feeCents, etaMinutes: q.etaMinutes, address: input.address,
    customerFeeCents: cfg.customerFee === "quote" ? q.feeCents : cfg.customerFee, expiresAt: q.expiresAt.toISOString(),
  };
  await db.insert(s.settingsKv).values({ key: `dq:${ref}`, value: stored });
  return { quoteRef: ref, feeCents: stored.customerFeeCents, etaMinutes: q.etaMinutes, by: provider.label };
}

export async function getStoredQuote(ref: string) {
  const db = await getDb();
  const row = await db.query.settingsKv.findFirst({ where: eq(s.settingsKv.key, `dq:${ref}`) });
  return (row?.value as StoredQuote | undefined) ?? null;
}

/** Books the driver for a paid delivery order. A failure is recorded so the kitchen sees it. */
export async function bookDelivery(orderId: string) {
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
  if (!o || o.fulfillment !== "delivery" || o.delivery || !o.deliveryAddress) return;
  const q = o.deliveryQuoteRef ? await getStoredQuote(o.deliveryQuoteRef) : null;
  const now = new Date().toISOString();
  let record: DeliveryRecord;
  try {
    if (!q) throw new DeliveryError("Delivery quote missing");
    const lines = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
    const booked = await providerByName(q.provider).book({
      ref: q.ref, quoteId: q.quoteId, pickup: await pickup(), dropoff: o.deliveryAddress, customerName: o.customerName, customerPhone: o.customerPhone ?? "",
      subtotalCents: o.subtotalCents, orderNumber: o.number, tipCents: o.tipCents, items: lines.map((l) => ({ name: l.nameSnapshot, quantity: l.quantity })),
    });
    record = { provider: q.provider, ...booked, bookedAt: now, checkedAt: now };
  } catch (e) {
    record = { provider: q?.provider ?? "demo", id: "", status: "failed", bookedAt: now, checkedAt: now, error: (e as Error).message };
  }
  await db.update(s.orders).set({ delivery: record }).where(eq(s.orders.id, orderId));
  if (record.status === "failed") await notifyOrder(orderId, "courier:failed");
}

/** Asks the service for the latest trip status (at most every 10 s per order) and acts on changes. */
export async function refreshDelivery(orderId: string) {
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
  const rec = o?.delivery;
  if (!o || !rec || !rec.id || COURIER_DONE.includes(rec.status) || Date.now() - new Date(rec.checkedAt).getTime() < 10_000) return;
  const ready = await db.query.orderEvents.findFirst({ where: and(eq(s.orderEvents.orderId, orderId), eq(s.orderEvents.toStatus, "ready")) });
  let next: Partial<DeliveryRecord> = {};
  try {
    next = await providerByName(rec.provider).status(rec, { readyAt: ready?.at ?? null });
  } catch (e) {
    console.error("delivery status failed", e);
  }
  const updated: DeliveryRecord = { ...rec, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)), checkedAt: new Date().toISOString() };
  await db.update(s.orders).set({ delivery: updated }).where(eq(s.orders.id, orderId));
  if (updated.status === rec.status) return;
  if (ALERT_COURIER.includes(updated.status)) await notifyOrder(orderId, `courier:${updated.status}`);
  // once the driver has the food, the kitchen is done with the ticket
  if (["picked_up", "at_dropoff", "delivered"].includes(updated.status) && canTransition(o.status as OrderStatus, "completed")) await transitionOrder(orderId, "completed");
}
