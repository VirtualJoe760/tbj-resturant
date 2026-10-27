import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { loadItemDefs } from "@/db/seed";
import { restaurant } from "@/config/restaurant";
import { isOpenNow, summarizeHours } from "@/domain/hours";
import { occurrences } from "@/domain/events";

export const LOCATION_ID = "main";

export function todayLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: restaurant.timezone });
}

export async function getLocation() {
  const db = await getDb();
  const loc = await db.query.locations.findFirst({ where: eq(s.locations.id, LOCATION_ID) });
  const hours = await db.select().from(s.locationHours).where(eq(s.locationHours.locationId, LOCATION_ID));
  return { ...loc!, hours, open: isOpenNow(hours, restaurant.timezone), hoursSummary: summarizeHours(hours) };
}

export const isSoldOut = (it: { soldOutUntil: Date | null }) => !!it.soldOutUntil && it.soldOutUntil > new Date();

export async function getMenu() {
  const db = await getDb();
  const [cats, its, defs] = await Promise.all([
    db.select().from(s.categories).where(eq(s.categories.isVisible, true)).orderBy(asc(s.categories.sort)),
    db.select().from(s.items).where(eq(s.items.isActive, true)).orderBy(asc(s.items.sort)),
    loadItemDefs(db),
  ]);
  return cats.map((c) => ({
    ...c,
    items: its.filter((i) => i.categoryId === c.id).map((i) => ({
      id: i.id, name: i.name, description: i.description, emoji: i.emoji, imageUrl: i.imageUrl, tags: i.tags,
      basePriceCents: i.basePriceCents, orderableOnline: i.orderableOnline, soldOut: isSoldOut(i), def: defs[i.id],
    })),
  }));
}
export type MenuCategory = Awaited<ReturnType<typeof getMenu>>[number];
export type MenuItemView = MenuCategory["items"][number];

export async function getHomeData() {
  const db = await getDb();
  const featured = await db
    .select({ id: s.items.id, name: s.items.name, emoji: s.items.emoji, price: s.items.basePriceCents, badge: s.featuredItems.badge, blurb: s.featuredItems.blurb })
    .from(s.featuredItems).innerJoin(s.items, eq(s.items.id, s.featuredItems.itemId)).orderBy(asc(s.featuredItems.sort));
  const evs = await db.select().from(s.events);
  const upcoming = occurrences(evs.filter((e) => e.showOnHome), todayLocal(), 45).slice(0, 4);
  return { featured, upcoming, location: await getLocation() };
}

export async function getUpcomingEvents(days = 60) {
  const db = await getDb();
  return occurrences(await db.select().from(s.events), todayLocal(), days);
}

export async function getFooterPages() {
  const db = await getDb();
  return db.select({ slug: s.pages.slug, title: s.pages.title, footerColumn: s.pages.footerColumn })
    .from(s.pages).where(eq(s.pages.status, "published"));
}

export async function getOrder(id: string) {
  const db = await getDb();
  const o = await db.query.orders.findFirst({ where: eq(s.orders.id, id) });
  if (!o) return null;
  const lines = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, id));
  return { ...o, lines };
}

export async function getKitchenOrders() {
  const db = await getDb();
  const live = await db.select().from(s.orders)
    .where(inArray(s.orders.status, ["paid", "accepted", "preparing", "ready"]))
    .orderBy(asc(s.orders.createdAt));
  const lines = live.length ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, live.map((o) => o.id))) : [];
  return live.map((o) => ({ ...o, lines: lines.filter((l) => l.orderId === o.id) }));
}

export async function getDashboard() {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const paidStatuses = ["paid", "accepted", "preparing", "ready", "completed"];
  const [agg] = await db.select({
    sales: sql<number>`coalesce(sum(${s.orders.totalCents}), 0)::int`,
    n: sql<number>`count(*)::int`,
    voice: sql<number>`count(*) filter (where ${s.orders.channel} = 'voice')::int`,
  }).from(s.orders).where(and(gte(s.orders.createdAt, since), inArray(s.orders.status, paidStatuses)));
  const newRequests = (await db.select({ n: sql<number>`count(*)::int` }).from(s.formSubmissions).where(eq(s.formSubmissions.status, "New")))[0].n;
  const covers = await db.select().from(s.shiftCoverRequests).where(inArray(s.shiftCoverRequests.status, ["open", "claimed"]));
  const recent = await db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(8);
  return { ...agg, avg: agg.n ? Math.round(agg.sales / agg.n) : 0, newRequests, coversOpen: covers.filter((c) => c.status === "open").length, coversClaimed: covers.filter((c) => c.status === "claimed").length, recent };
}
