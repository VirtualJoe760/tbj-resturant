"use server";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/db/client";
import { loadItemDefs } from "@/db/seed";
import { validateSelections, describeSelections } from "@/domain/cart";
import { priceCart, priceLine, type Selections } from "@/domain/pricing";
import { orderNumber } from "@/domain/orders";
import { getPaymentProvider } from "@/payments/provider";
import { getUser } from "@/auth/session";
import { isSoldOut, LOCATION_ID, unavailableCategoryIds } from "@/server/queries";
import { sendEmail, simpleEmail } from "@/server/email";
import { markPaid } from "@/server/order-service";
import { restaurant } from "@/config/restaurant";
import type { DeliveryAddress } from "@/domain/delivery";
import { DeliveryError } from "@/delivery/provider";
import { getStoredQuote, quoteDelivery } from "@/server/delivery-service";

type Result = { ok: boolean; message: string } | null;

export async function subscribe(_: Result, form: FormData): Promise<Result> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { ok: false, message: "That email doesn't look right." };
  const db = await getDb();
  await db.insert(s.subscribers).values({ email: email.data.toLowerCase() }).onConflictDoNothing();
  await sendEmail(db, { to: email.data, subject: `You're on the ${restaurant.shortName} list`, kind: "newsletter-welcome", html: simpleEmail("<p>Thanks for joining! Expect deals, events and new pizzas — one email a week, tops.</p>") });
  return { ok: true, message: "You're in! Check your inbox." };
}

const Address = z.object({
  street: z.string().trim().min(3).max(120),
  unit: z.string().trim().max(30).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().length(2).toUpperCase(),
  zip: z.string().trim().regex(/^\d{5}$/),
  instructions: z.string().trim().max(200).optional(),
});

/** Delivery price and time for checkout. The quote is kept on the server; placeOrder uses it by ref. */
export async function getDeliveryQuote(input: { address: DeliveryAddress; subtotalCents: number; name: string; phone: string }):
  Promise<{ ok: true; quoteRef: string; feeCents: number; etaMinutes: number; by: string } | { ok: false; error: string }> {
  const a = Address.safeParse(input.address);
  if (!a.success) return { ok: false, error: "Check the street, city, state (2 letters) and 5-digit ZIP." };
  try {
    return { ok: true, ...(await quoteDelivery({ ...input, address: a.data })) };
  } catch (e) {
    return { ok: false, error: e instanceof DeliveryError ? e.message : "Couldn't get a delivery price. Try again or choose pickup." };
  }
}

const OrderInput = z.object({
  lines: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().min(1).max(50),
    selections: z.record(z.string(), z.object({
      action: z.enum(["choose", "add", "keep", "remove"]),
      qty: z.enum(["light", "normal", "extra"]).optional(),
      place: z.enum(["whole", "left", "right"]).optional(),
    })),
    instructions: z.string().max(200).optional(),
  })).min(1),
  name: z.string().min(1).max(80),
  phone: z.string().min(7).max(30),
  email: z.string().email().optional().or(z.literal("")),
  tipPct: z.number().min(0).max(0.5),
  notes: z.string().max(300).optional(),
  fulfillment: z.enum(["pickup", "delivery"]).default("pickup"),
  deliveryQuoteRef: z.string().max(80).optional(),
});

/** Re-prices the cart on the server, creates the order, and starts payment. */
export async function placeOrder(input: z.infer<typeof OrderInput>): Promise<{ ok: true; orderId: string; redirectUrl: string | null } | { ok: false; error: string }> {
  const parsed = OrderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check your name, phone and cart." };
  const o = parsed.data;
  const db = await getDb();
  const loc = await db.query.locations.findFirst({ where: eq(s.locations.id, LOCATION_ID) });
  if (loc?.orderingPaused) return { ok: false, error: "Online ordering is paused right now. Please call us." };
  const defs = await loadItemDefs(db);
  const itemRows = await db.select().from(s.items);
  const offMenu = await unavailableCategoryIds();

  const lines = [];
  for (const l of o.lines) {
    const def = defs[l.itemId];
    const row = itemRows.find((r) => r.id === l.itemId);
    if (!def || !row || !row.isActive || !row.orderableOnline) return { ok: false, error: "An item in your cart isn't available online." };
    if (isSoldOut(row)) return { ok: false, error: `${row.name} just sold out — remove it to continue.` };
    if (offMenu.includes(row.categoryId)) return { ok: false, error: `${row.name} isn't being served right now — remove it to continue.` };
    const sel = l.selections as Selections;
    const v = validateSelections(def, sel);
    if (!v.ok) return { ok: false, error: `${def.name}: ${v.errors[0]}` };
    const unit = priceLine(def, sel);
    lines.push({ def, sel, unit, quantity: l.quantity, instructions: l.instructions });
  }
  const totals = priceCart(lines.map((l) => ({ unitCents: l.unit, quantity: l.quantity })), { taxRate: loc!.taxRate, tipPct: o.tipPct });

  // delivery: the fee comes from the quote stored on the server, never from the browser
  let delivery: { address: DeliveryAddress; feeCents: number; ref: string } | null = null;
  if (o.fulfillment === "delivery") {
    const q = o.deliveryQuoteRef ? await getStoredQuote(o.deliveryQuoteRef) : null;
    if (!q) return { ok: false, error: "Get a delivery price first (enter your address)." };
    if (new Date(q.expiresAt) < new Date()) return { ok: false, error: "That delivery price expired. Tap “Update price” and try again." };
    if (loc?.deliveryPaused) return { ok: false, error: "Delivery just paused. Choose pickup or try again soon." };
    if (totals.subtotal < (restaurant.delivery?.minOrderCents ?? 0)) return { ok: false, error: "Your order is under the delivery minimum." };
    delivery = { address: q.address, feeCents: q.customerFeeCents, ref: o.deliveryQuoteRef! };
    totals.total += q.customerFeeCents;
  }
  const user = await getUser();
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(substring(${s.orders.number} from 2)::int), 0)::int` }).from(s.orders);
  const number = orderNumber(n + 1);
  const provider = getPaymentProvider();

  const [order] = await db.insert(s.orders).values({
    number, locationId: LOCATION_ID, customerUserId: user?.id ?? null, channel: "web", status: "pending_payment",
    subtotalCents: totals.subtotal, taxCents: totals.tax, tipCents: totals.tip, totalCents: totals.total, discountCents: totals.discount,
    customerName: o.name, customerPhone: o.phone, customerEmail: o.email || null, notes: o.notes || null,
    paymentProvider: provider.name, pickupAt: new Date(Date.now() + (loc!.pickupLeadMinutes + (loc!.busy ? 15 : 0)) * 60000),
    ...(delivery ? { fulfillment: "delivery" as const, deliveryAddress: delivery.address, deliveryFeeCents: delivery.feeCents, deliveryQuoteRef: delivery.ref } : {}),
  }).returning();
  await db.insert(s.orderItems).values(lines.map((l) => ({
    orderId: order.id, itemId: l.def.id, nameSnapshot: l.def.name, unitPriceCents: l.unit, quantity: l.quantity,
    lineTotalCents: l.unit * l.quantity, selections: l.sel, modifiersText: describeSelections(l.def, l.sel).map((d) => d.label), instructions: l.instructions,
  })));

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const pay = await provider.startCheckout({ orderId: order.id, orderNumber: number, amountCents: totals.total, customerEmail: o.email, successUrl: `${origin}/order/${order.id}`, cancelUrl: `${origin}/checkout` });
  await db.update(s.orders).set({ paymentRef: pay.ref }).where(eq(s.orders.id, order.id));
  if (!pay.redirectUrl) await markPaid(order.id); // demo: the test card "succeeds" right away
  return { ok: true, orderId: order.id, redirectUrl: pay.redirectUrl };
}

export async function submitForm(slug: string, _: Result, form: FormData): Promise<Result> {
  const db = await getDb();
  const page = await db.query.pages.findFirst({ where: eq(s.pages.slug, slug) });
  if (!page?.formSchema) return { ok: false, message: "This form isn't available." };
  if (form.get("website")) return { ok: true, message: "Thanks!" }; // honeypot: bots fill hidden fields
  const data: Record<string, string> = {};
  for (const f of page.formSchema) {
    const v = String(form.get(f.key) ?? "").trim();
    if (f.required && !v && f.type !== "file") return { ok: false, message: `${f.label} is required.` };
    if (f.type === "email" && v && !z.string().email().safeParse(v).success) return { ok: false, message: "Check the email address." };
    if (f.type === "file") {
      const file = form.get(f.key);
      if (file instanceof File && file.size) data[f.key] = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    } else if (v) data[f.key] = v.slice(0, 2000);
  }
  const name = data.band ?? data.company ?? data.name ?? "New request";
  const email = data.email ?? null;
  await db.insert(s.formSubmissions).values({ pageId: page.id, data, submitterName: name, submitterEmail: email });
  if (email) await sendEmail(db, { to: email, subject: `We got your request — ${page.title}`, kind: "form-autoreply", html: simpleEmail(`<p>Thanks, ${data.name ?? name}! We received your request for <b>${page.title}</b> and will get back to you soon.</p>`) });
  await sendEmail(db, { to: page.notifyEmail ?? `admin@${restaurant.domain}`, subject: `New request: ${page.title} — ${name}`, kind: "form-notify", html: simpleEmail(`<p>${Object.entries(data).map(([k, v]) => `<b>${k}</b>: ${v}`).join("<br>")}</p>`) });
  return { ok: true, message: "Sent! We'll get back to you soon." };
}
