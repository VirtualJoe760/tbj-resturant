import "server-only";
import { createHash } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import webpush from "web-push";
import { getDb, schema as s } from "@/db/client";
import { restaurant } from "@/config/restaurant";
import { alertText, type OrderAlert } from "@/domain/order-alerts";

// Order alerts: a row on the customer's dashboard + a phone notification (Web Push) for every
// device that turned them on. Push keys (VAPID) come from env vars, or are generated once and kept
// in the database, so a new client site needs no setup.

async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const db = await getDb();
  const row = await db.query.settingsKv.findFirst({ where: eq(s.settingsKv.key, "vapid") });
  if (row?.value) return row.value as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  await db.insert(s.settingsKv).values({ key: "vapid", value: keys }).onConflictDoNothing();
  const saved = await db.query.settingsKv.findFirst({ where: eq(s.settingsKv.key, "vapid") }); // another request may have won
  return saved!.value as { publicKey: string; privateKey: string };
}

export const pushPublicKey = async () => (await vapidKeys()).publicKey;

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, owner: { userId?: string | null; orderId?: string | null }) {
  const db = await getDb();
  const id = createHash("sha256").update(`${sub.endpoint}|${owner.userId ?? ""}|${owner.orderId ?? ""}`).digest("hex").slice(0, 40);
  await db.insert(s.pushSubscriptions).values({ id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId: owner.userId ?? null, orderId: owner.orderId ?? null })
    .onConflictDoUpdate({ target: s.pushSubscriptions.id, set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
}

/** Records the alert for the order's customer and pushes it to their devices. Never throws. */
export async function notifyOrder(orderId: string, alert: OrderAlert) {
  try {
    const db = await getDb();
    const o = await db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
    if (!o) return;
    const { title, body } = alertText(alert, { number: o.number, fulfillment: o.fulfillment, place: restaurant.shortName });
    const url = `/order/${o.id}`;
    await db.insert(s.notifications).values({ orderId, userId: o.customerUserId, title, body, url });

    const subs = await db.select().from(s.pushSubscriptions).where(o.customerUserId ? or(eq(s.pushSubscriptions.orderId, orderId), eq(s.pushSubscriptions.userId, o.customerUserId)) : eq(s.pushSubscriptions.orderId, orderId));
    if (!subs.length) return;
    const keys = await vapidKeys();
    webpush.setVapidDetails(`mailto:admin@${restaurant.domain}`, keys.publicKey, keys.privateKey);
    const payload = JSON.stringify({ title, body, url, tag: `order-${o.id}` });
    const gone: string[] = [];
    for (const endpoint of new Set(subs.map((x) => x.endpoint))) {
      const sub = subs.find((x) => x.endpoint === endpoint)!;
      await webpush.sendNotification({ endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 }).catch((e: { statusCode?: number }) => {
        if (e.statusCode === 404 || e.statusCode === 410) gone.push(endpoint); // phone unsubscribed
      });
    }
    if (gone.length) await db.delete(s.pushSubscriptions).where(inArray(s.pushSubscriptions.endpoint, gone));
  } catch (e) {
    console.error("order alert failed", e);
  }
}
