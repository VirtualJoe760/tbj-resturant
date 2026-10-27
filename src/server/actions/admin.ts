"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ADMIN_ROLES, KITCHEN_ROLES, requireRole } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import type { FormField } from "@/db/schema";
import type { OrderStatus } from "@/domain/orders";
import { transitionOrder } from "@/server/order-service";
import { sendEmail, simpleEmail } from "@/server/email";
import { LOCATION_ID } from "@/server/queries";
import { restaurant } from "@/config/restaurant";

const done = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));

// ── kitchen ──
export async function advanceOrder(orderId: string, to: OrderStatus) {
  const u = await requireRole(KITCHEN_ROLES);
  await transitionOrder(orderId, to, u.id);
  done("/kitchen", "/admin");
}

/** 86 an item until the end of the business day (4 AM local, after a 2 AM close). */
export async function toggle86(itemId: string) {
  await requireRole(KITCHEN_ROLES);
  const db = await getDb();
  const it = await db.query.items.findFirst({ where: eq(s.items.id, itemId) });
  if (!it) return;
  const soldOut = it.soldOutUntil && it.soldOutUntil > new Date();
  let until: Date | null = null;
  if (!soldOut) {
    until = new Date();
    until.setHours(until.getHours() < 4 ? 4 : 28, 0, 0, 0);
  }
  await db.update(s.items).set({ soldOutUntil: until }).where(eq(s.items.id, itemId));
  done("/kitchen/86", "/admin/menu", "/menu");
}

// ── store status ──
export async function setStoreFlag(flag: "busy" | "orderingPaused", value: boolean) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.update(s.locations).set({ [flag]: value }).where(eq(s.locations.id, LOCATION_ID));
  done("/admin", "/", "/menu");
}

export async function refundOrder(orderId: string) {
  const u = await requireRole(ADMIN_ROLES);
  await transitionOrder(orderId, "refunded", u.id);
  done("/admin/orders");
}

// ── menu ──
export async function updateItem(form: FormData) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  const id = String(form.get("id"));
  const price = Math.round(Number(form.get("price")) * 100);
  if (!Number.isFinite(price) || price < 0) return;
  await db.update(s.items).set({
    name: String(form.get("name")).slice(0, 80), description: String(form.get("description") ?? "").slice(0, 300),
    basePriceCents: price, isActive: form.get("isActive") === "on", orderableOnline: form.get("orderableOnline") === "on",
  }).where(eq(s.items.id, id));
  done("/admin/menu", "/menu", "/");
}

export async function addItem(form: FormData) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  const name = String(form.get("name") ?? "").trim();
  const price = Math.round(Number(form.get("price")) * 100);
  if (!name || !Number.isFinite(price)) return;
  await db.insert(s.items).values({ name, description: String(form.get("description") ?? ""), basePriceCents: price, categoryId: String(form.get("categoryId")), emoji: String(form.get("emoji") || "🍽️"), sort: 999 });
  done("/admin/menu", "/menu");
}

// ── events ──
export async function saveEvent(form: FormData) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  const title = String(form.get("title") ?? "").trim();
  const date = String(form.get("date") ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await db.insert(s.events).values({
    title, date, startTime: String(form.get("startTime") || "20:00"), repeat: (String(form.get("repeat") ?? "") as "" | "weekly" | "monthly"),
    category: String(form.get("category") ?? "Other"), description: String(form.get("description") ?? ""),
    linkPageSlug: String(form.get("linkPageSlug") || "") || null, showOnHome: form.get("showOnHome") === "on",
  });
  if (form.get("newsletter") === "on") await db.insert(s.settingsKv).values({ key: `newsletter-event-${Date.now()}`, value: { title, date } });
  done("/admin/events", "/events", "/");
}

export async function deleteEvent(id: string) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.delete(s.events).where(eq(s.events.id, id));
  done("/admin/events", "/events", "/");
}

export async function toggleEventHome(id: string, value: boolean) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.update(s.events).set({ showOnHome: value }).where(eq(s.events.id, id));
  done("/admin/events", "/");
}

// ── pages & requests ──
export async function savePage(form: FormData) {
  await requireRole(["webmaster", "admin"]);
  const db = await getDb();
  const id = String(form.get("id"));
  const fields = z.array(z.object({
    key: z.string(), label: z.string().min(1), type: z.enum(["text", "textarea", "email", "tel", "date", "number", "select", "file"]),
    required: z.boolean().optional(), options: z.array(z.string()).optional(),
  })).safeParse(JSON.parse(String(form.get("fields") || "null") || "null"));
  await db.update(s.pages).set({
    title: String(form.get("title")), subtitle: String(form.get("subtitle") ?? ""), bodyHtml: String(form.get("bodyHtml") ?? ""),
    status: form.get("published") === "on" ? "published" : "draft", submitLabel: String(form.get("submitLabel") || "Send"),
    notifyEmail: String(form.get("notifyEmail") || "") || null, footerColumn: String(form.get("footerColumn") || "") || null,
    ...(fields.success ? { formSchema: fields.data as FormField[] } : {}), updatedAt: new Date(),
  }).where(eq(s.pages.id, id));
  done("/admin/pages", "/", "/p/[slug]", "/privacy", "/terms");
}

export async function createPage(form: FormData) {
  await requireRole(["webmaster", "admin"]);
  const db = await getDb();
  const title = String(form.get("title") ?? "").trim() || "New page";
  const kind = form.get("kind") === "blank" ? "blank" : "form";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 5);
  const [p] = await db.insert(s.pages).values({
    slug, title, kind, status: "draft", bodyHtml: "<p>Tell visitors what this page is for.</p>",
    formSchema: kind === "form" ? [{ key: "name", label: "Your name", type: "text", required: true }, { key: "email", label: "Email", type: "email", required: true }, { key: "message", label: "Message", type: "textarea" }] : null,
    requestType: kind === "form" ? "other" : null,
  }).returning({ id: s.pages.id });
  done("/admin/pages");
  return p.id;
}

export async function setRequestStatus(id: string, status: string) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.update(s.formSubmissions).set({ status }).where(eq(s.formSubmissions.id, id));
  done("/admin/requests", "/admin", "/admin/more");
}

export async function sendDepositLink(id: string, dollars: number) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  const sub = await db.query.formSubmissions.findFirst({ where: eq(s.formSubmissions.id, id) });
  if (!sub?.submitterEmail) return { ok: false, message: "No email on this request" };
  const cents = Math.round(dollars * 100);
  await db.update(s.formSubmissions).set({ depositCents: cents, status: "Quoted" }).where(eq(s.formSubmissions.id, id));
  // Live: a Stripe payment link (card or bank transfer). Demo: captured email with a placeholder link.
  await sendEmail(db, { to: sub.submitterEmail, subject: `Deposit for your booking at ${restaurant.shortName}`, kind: "deposit-link",
    html: simpleEmail(`<p>Hi ${sub.submitterName ?? ""}! To lock in your date, please pay a $${dollars.toFixed(2)} deposit.</p><p><a href="#" style="background:${restaurant.theme.primary};color:#18181b;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Pay deposit — card or bank transfer</a></p>`) });
  done("/admin/requests");
  return { ok: true, message: "Deposit link sent" };
}

// ── team ──
export async function inviteEmployee(form: FormData) {
  await requireRole(["webmaster", "admin", "manager"]);
  const db = await getDb();
  const name = String(form.get("name") ?? "").trim();
  const contact = String(form.get("contact") ?? "").trim();
  if (!name || !contact) return;
  const code = `${restaurant.shortName.replace(/\W/g, "").slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await db.insert(s.staffInvites).values({ code, name, contact, position: String(form.get("position") ?? "Server") });
  if (contact.includes("@")) await sendEmail(db, { to: contact, subject: `You're invited to join ${restaurant.shortName}`, kind: "staff-invite", html: simpleEmail(`<p>Hi ${name}! Create your staff account with code <b>${code}</b> at /staff/join.</p>`) });
  done("/admin/team");
}

// ── newsletter ──
export async function sendCampaign(form: FormData) {
  await requireRole(["webmaster", "admin"]);
  const db = await getDb();
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!subject || !body) return;
  const subs = await db.select().from(s.subscribers).where(eq(s.subscribers.status, "active"));
  const html = simpleEmail(body.split(/\n{2,}/).map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`).join("") + `<p style="font-size:11px;color:#78716c">Unsubscribe anytime.</p>`);
  for (const sub of subs) await sendEmail(db, { to: sub.email, subject, html, kind: "newsletter" });
  await db.insert(s.campaigns).values({ subject, body, status: "sent", sentCount: subs.length, sentAt: new Date() });
  done("/admin/newsletter");
}

// ── scheduling ──
const ShiftInput = z.object({ id: z.string().optional(), employeeId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), position: z.string(), weekStart: z.string() });

async function markChanged(weekStart: string) {
  const db = await getDb();
  await db.insert(s.schedules).values({ weekStart, status: "changed" }).onConflictDoUpdate({ target: s.schedules.weekStart, set: { status: "changed" } });
}

export async function saveShift(input: z.infer<typeof ShiftInput>) {
  await requireRole(ADMIN_ROLES);
  const v = ShiftInput.parse(input);
  const db = await getDb();
  if (v.id) await db.update(s.shifts).set({ employeeId: v.employeeId, date: v.date, start: v.start, end: v.end, position: v.position }).where(eq(s.shifts.id, v.id));
  else await db.insert(s.shifts).values({ weekStart: v.weekStart, employeeId: v.employeeId, date: v.date, start: v.start, end: v.end, position: v.position });
  await markChanged(v.weekStart);
  done("/admin/schedule", "/staff");
}

export async function deleteShift(id: string, weekStart: string) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.delete(s.shifts).where(eq(s.shifts.id, id));
  await markChanged(weekStart);
  done("/admin/schedule", "/staff");
}

export async function publishSchedule(weekStart: string) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.insert(s.schedules).values({ weekStart, status: "published", publishedAt: new Date() })
    .onConflictDoUpdate({ target: s.schedules.weekStart, set: { status: "published", publishedAt: new Date() } });
  const team = await db.select().from(s.employees).where(eq(s.employees.status, "active"));
  done("/admin/schedule", "/staff");
  return team.length;
}

export async function copyLastWeek(weekStart: string) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  const prev = new Date(weekStart + "T12:00:00");
  prev.setDate(prev.getDate() - 7);
  const prevStart = prev.toISOString().slice(0, 10);
  const prevShifts = await db.select().from(s.shifts).where(eq(s.shifts.weekStart, prevStart));
  if (!prevShifts.length) return 0;
  await db.insert(s.shifts).values(prevShifts.map(({ id: _id, ...sh }) => {
    const d = new Date(sh.date + "T12:00:00");
    d.setDate(d.getDate() + 7);
    return { ...sh, weekStart, date: d.toISOString().slice(0, 10) };
  }));
  await markChanged(weekStart);
  done("/admin/schedule");
  return prevShifts.length;
}

export async function decideTimeOff(id: string, approve: boolean) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  await db.update(s.timeOffRequests).set({ status: approve ? "approved" : "denied" }).where(eq(s.timeOffRequests.id, id));
  done("/admin/schedule", "/staff/availability");
}

export async function decideCover(id: string, approve: boolean) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  const c = await db.query.shiftCoverRequests.findFirst({ where: eq(s.shiftCoverRequests.id, id) });
  if (!c || c.status !== "claimed") return;
  await db.update(s.shiftCoverRequests).set({ status: approve ? "approved" : "denied" }).where(eq(s.shiftCoverRequests.id, id));
  if (approve && c.claimedByEmployeeId) {
    const sh = await db.query.shifts.findFirst({ where: eq(s.shifts.id, c.shiftId) });
    await db.update(s.shifts).set({ employeeId: c.claimedByEmployeeId }).where(eq(s.shifts.id, c.shiftId));
    if (sh) await markChanged(sh.weekStart);
  }
  done("/admin/schedule", "/staff", "/staff/cover", "/admin");
}

export async function approveTimesheets(ids: string[]) {
  await requireRole(ADMIN_ROLES);
  const db = await getDb();
  if (ids.length) await db.update(s.timeEntries).set({ approvedAt: new Date() }).where(and(inArray(s.timeEntries.id, ids)));
  done("/admin/timesheets");
}
