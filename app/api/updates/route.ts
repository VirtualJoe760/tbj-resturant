import { and, desc, gt, inArray, isNull, or, eq, type SQL } from "drizzle-orm";
import { getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { refreshDelivery } from "@/server/delivery-service";

const LIVE = ["pending_payment", "paid", "accepted", "preparing", "ready"];

// Order alerts for this phone: the orders it follows (?orders=id,id; guests) plus the signed-in
// customer's own. Also nudges any live deliveries so driver updates show up while someone watches.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("orders") ?? "").split(",").filter((x) => /^[\w-]{8,64}$/.test(x)).slice(0, 10);
  const after = new Date(url.searchParams.get("after") ?? 0);
  const user = await getUser();
  const db = await getDb();

  const mine: SQL[] = [];
  if (ids.length) mine.push(inArray(s.orders.id, ids));
  if (user) mine.push(eq(s.orders.customerUserId, user.id));
  if (!mine.length) return Response.json({ items: [], live: [] });
  const orders = await db.select({ id: s.orders.id, number: s.orders.number, status: s.orders.status, fulfillment: s.orders.fulfillment, delivery: s.orders.delivery, createdAt: s.orders.createdAt })
    .from(s.orders).where(or(...mine)).orderBy(desc(s.orders.createdAt)).limit(20);

  const live = orders.filter((o) => LIVE.includes(o.status) || (o.delivery && !["delivered", "cancelled", "failed"].includes(o.delivery.status)));
  await Promise.all(live.filter((o) => o.delivery).map((o) => refreshDelivery(o.id)));

  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await db.select().from(s.notifications).where(and(inArray(s.notifications.orderId, orderIds), gt(s.notifications.createdAt, after))).orderBy(desc(s.notifications.createdAt)).limit(20)
    : [];
  const unread = user ? (await db.select({ id: s.notifications.id }).from(s.notifications).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)))).length : 0;
  return Response.json({ items, unread, live: live.map((o) => ({ id: o.id, number: o.number, status: o.status, fulfillment: o.fulfillment, courier: o.delivery?.status ?? null })) });
}

/** Marks the signed-in customer's alerts as read (opening the Account tab). */
export async function POST() {
  const user = await getUser();
  if (!user) return Response.json({ ok: false });
  const db = await getDb();
  await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)));
  return Response.json({ ok: true });
}
