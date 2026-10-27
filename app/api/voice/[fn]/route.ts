import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { loadItemDefs } from "@/db/seed";
import { describeSelections, validateSelections } from "@/domain/cart";
import { orderNumber } from "@/domain/orders";
import { priceCart, priceLine, type Selections } from "@/domain/pricing";
import { parseSpokenModifiers, speakMoney } from "@/domain/voice";
import { getLocation, isSoldOut, LOCATION_ID } from "@/server/queries";
import { restaurant } from "@/config/restaurant";

// Retell function-call endpoints (docs/04-voice-agent.md). Every answer has a short `say`.
// Auth: Retell sends our shared secret in `x-voice-secret` (set VOICE_FUNCTION_SECRET).
// Each call's cart lives in settings_kv under voice-cart:<call_id>.

interface VoiceLine { id: string; itemId: string; name: string; quantity: number; unitCents: number; selections: Selections; modifiers: string[] }
interface VoiceCart { lines: VoiceLine[]; name?: string; phone?: string }

async function loadCart(callId: string): Promise<VoiceCart> {
  const db = await getDb();
  const row = await db.query.settingsKv.findFirst({ where: eq(s.settingsKv.key, `voice-cart:${callId}`) });
  return (row?.value as VoiceCart) ?? { lines: [] };
}
async function saveCart(callId: string, cart: VoiceCart) {
  const db = await getDb();
  await db.insert(s.settingsKv).values({ key: `voice-cart:${callId}`, value: cart }).onConflictDoUpdate({ target: s.settingsKv.key, set: { value: cart } });
}

const ok = (data: object) => NextResponse.json({ ok: true, ...data });
const fail = (say: string, data: object = {}) => NextResponse.json({ ok: false, say, ...data });

export async function POST(req: Request, { params }: { params: Promise<{ fn: string }> }) {
  const secret = process.env.VOICE_FUNCTION_SECRET;
  if (secret && req.headers.get("x-voice-secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { fn } = await params;
  const body = await req.json().catch(() => ({}));
  const args = body.args ?? body; // Retell wraps arguments in `args`
  const callId: string = body.call?.call_id ?? args.call_id ?? "test-call";
  const db = await getDb();

  switch (fn) {
    case "get_store_status": {
      const loc = await getLocation();
      const wait = loc.pickupLeadMinutes + (loc.busy ? 15 : 0);
      return ok({ open: loc.open, wait_minutes: wait, say: loc.orderingPaused ? "We're not taking phone orders right this minute." : loc.open ? `We're open. Pickup is about ${wait} minutes.` : `We're closed right now. Our hours are ${loc.hoursSummary.join(", ")}.` });
    }
    case "search_menu": {
      const q = String(args.query ?? "").toLowerCase();
      const items = await db.select().from(s.items).where(eq(s.items.isActive, true));
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const hits = items.filter((i) => words.some((w) => i.name.toLowerCase().includes(w) || i.description.toLowerCase().includes(w))).slice(0, 5);
      if (!hits.length) return fail("I couldn't find that on our menu. Want me to read the pizza list?", { candidates: [] });
      return ok({ candidates: hits.map((i) => ({ item_id: i.id, name: i.name, price_cents: i.basePriceCents, sold_out: isSoldOut(i), phone_orderable: i.orderableOnline })), say: hits.length === 1 ? `We have the ${hits[0].name}.` : `We have ${hits.map((h) => h.name).join(", ")}. Which one?` });
    }
    case "get_item": {
      const defs = await loadItemDefs(db);
      const def = defs[String(args.item_id)];
      if (!def) return fail("I couldn't find that item.");
      const groups = def.groups.map((g) => ({ id: g.id, name: g.name, kind: g.kind, required: g.min > 0, options: g.mods.map((m) => ({ modifier_id: m.id, name: m.name, price_cents: m.priceCents })) }));
      const req = def.groups.filter((g) => g.min > 0).map((g) => `${g.name.toLowerCase()}: ${g.mods.map((m) => m.name.replace(/\s*\(.*\)/, "")).join(" or ")}`);
      return ok({ item_id: def.id, name: def.name, base_price_cents: def.basePriceCents, groups, say: `${def.name} is ${speakMoney(def.basePriceCents)}.${req.length ? ` I'll need the ${req.join("; ")}.` : ""}` });
    }
    case "add_to_cart": {
      const defs = await loadItemDefs(db);
      const def = defs[String(args.item_id)];
      const row = def && (await db.query.items.findFirst({ where: eq(s.items.id, def.id) }));
      if (!def || !row) return fail("I couldn't find that item.");
      if (isSoldOut(row)) return fail(`Sorry, we're out of ${def.name} tonight.`);
      if (!row.orderableOnline) return fail(`${def.name} is dine-in only.`);
      // Either structured selections or the caller's own words ("hold the sausage, add onions").
      let sel: Selections;
      let heard: string[] = [];
      if (Array.isArray(args.selections)) {
        const parsed = parseSpokenModifiers(def, "");
        sel = parsed.selections;
        for (const x of args.selections) sel[x.modifier_id] = { action: x.action ?? "choose", qty: x.quantity, place: x.placement };
      } else {
        const parsed = parseSpokenModifiers(def, String(args.modifiers_spoken ?? ""));
        if (parsed.ambiguous.length) return fail(`Did you mean ${parsed.ambiguous[0].options.join(" or ")}?`, { ambiguous: parsed.ambiguous });
        sel = parsed.selections;
        heard = parsed.unmatched;
      }
      const v = validateSelections(def, sel);
      if (!v.ok) return fail(v.errors[0] + "?", { errors: v.errors });
      const qty = Math.max(1, Math.min(20, Number(args.quantity) || 1));
      const unit = priceLine(def, sel);
      const mods = describeSelections(def, sel).map((d) => d.label);
      const cart = await loadCart(callId);
      const line: VoiceLine = { id: `l${cart.lines.length + 1}`, itemId: def.id, name: def.name, quantity: qty, unitCents: unit, selections: sel, modifiers: mods };
      cart.lines.push(line);
      await saveCart(callId, cart);
      const spoken = `${qty > 1 ? qty + " " : ""}${def.name}${mods.length ? ", " + mods.join(", ").toLowerCase() : ""}`;
      return ok({ line_id: line.id, line_total_cents: unit * qty, not_understood: heard, say: `${spoken} — ${speakMoney(unit * qty)}.${heard.length ? ` I didn't catch "${heard[0]}".` : ""}` });
    }
    case "remove_line": {
      const cart = await loadCart(callId);
      cart.lines = cart.lines.filter((l) => l.id !== args.line_id);
      await saveCart(callId, cart);
      return ok({ say: "Removed." });
    }
    case "get_cart": {
      const cart = await loadCart(callId);
      const loc = await getLocation();
      const t = priceCart(cart.lines.map((l) => ({ unitCents: l.unitCents, quantity: l.quantity })), { taxRate: loc.taxRate });
      return ok({ lines: cart.lines, total_cents: t.total, say: cart.lines.length ? `I have ${cart.lines.map((l) => `${l.quantity} ${l.name}${l.modifiers.length ? " with " + l.modifiers.join(", ").toLowerCase() : ""}`).join("; ")}. With tax that's ${speakMoney(t.total)}.` : "Your order is empty so far." });
    }
    case "set_customer": {
      const cart = await loadCart(callId);
      cart.name = String(args.name ?? "").slice(0, 80);
      cart.phone = String(args.phone ?? body.call?.from_number ?? "").slice(0, 30);
      await saveCart(callId, cart);
      return ok({ say: `Got it, ${cart.name}.` });
    }
    case "submit_order": {
      const cart = await loadCart(callId);
      if (!cart.lines.length) return fail("There's nothing in the order yet.");
      if (!cart.name) return fail("What name should I put the order under?");
      const loc = await getLocation();
      const t = priceCart(cart.lines.map((l) => ({ unitCents: l.unitCents, quantity: l.quantity })), { taxRate: loc.taxRate });
      const [{ n }] = await db.select({ n: sql<number>`coalesce(max(substring(${s.orders.number} from 2)::int), 0)::int` }).from(s.orders);
      const number = orderNumber(n + 1);
      // pay at pickup: goes straight to the kitchen as "accepted"
      const [order] = await db.insert(s.orders).values({
        number, locationId: LOCATION_ID, channel: "voice", status: "accepted", customerName: cart.name, customerPhone: cart.phone ?? null,
        subtotalCents: t.subtotal, taxCents: t.tax, tipCents: 0, totalCents: t.total, paymentProvider: "at_pickup",
        pickupAt: new Date(Date.now() + (loc.pickupLeadMinutes + (loc.busy ? 15 : 0)) * 60000),
      }).returning();
      await db.insert(s.orderItems).values(cart.lines.map((l) => ({ orderId: order.id, itemId: l.itemId, nameSnapshot: l.name, unitPriceCents: l.unitCents, quantity: l.quantity, lineTotalCents: l.unitCents * l.quantity, selections: l.selections, modifiersText: l.modifiers })));
      await db.delete(s.settingsKv).where(eq(s.settingsKv.key, `voice-cart:${callId}`));
      return ok({ order_id: order.id, order_number: number, say: `You're all set, ${cart.name}. Order ${number.split("").join(" ")} will be ready in about ${loc.pickupLeadMinutes} minutes at ${restaurant.shortName}. Pay when you pick up.` });
    }
    default:
      return NextResponse.json({ error: `unknown function ${fn}` }, { status: 404 });
  }
}
