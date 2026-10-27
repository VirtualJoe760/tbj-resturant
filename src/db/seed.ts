import { count } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { restaurant } from "@/config/restaurant";
import { defaultSelections, priceLine, type ItemDef } from "@/domain/pricing";
import { describeSelections } from "@/domain/cart";
import * as s from "./schema";
import { TEST_ACCOUNTS, TEST_PASSWORD, testEmail } from "./test-accounts";
import type { PgliteDatabase } from "drizzle-orm/pglite";

type Db = PgliteDatabase<typeof s>;
const LOC = "main";

// ── The Hood's menu (from Yelp, prices TBD with owner) ──
type G = { id: string; name: string; kind: "choice" | "addon" | "removal" | "option"; min: number; max: number; mods: [string, string, number, { def?: boolean; extra?: number }?][] };
const removal = (id: string, names: string[], extraCheese?: string): G => ({
  id, name: "Comes with", kind: "removal", min: 0, max: names.length,
  mods: names.map((n) => [`${id}-${n.toLowerCase().replace(/[^a-z]+/g, "-")}`, n, 0, { def: true, extra: n === extraCheese ? 150 : undefined }]),
});
const GROUPS: G[] = [
  { id: "size", name: "Size", kind: "choice", min: 1, max: 1, mods: [["slice", "Jumbo slice (2 big slices)", 0, { def: true }], ["whole", "Whole pie", 1900]] },
  { id: "tops", name: "Add toppings", kind: "addon", min: 0, max: 5, mods: [
    ["t-jal", "Jalapeños", 150], ["t-onion", "Onions", 150], ["t-pine", "Pineapple", 150], ["t-spin", "Spinach", 150],
    ["t-mush", "Mushrooms", 150], ["t-olive", "Olives", 150], ["t-bacon", "Bacon", 250], ["t-chix", "Chicken", 250], ["t-saus", "Sausage", 250], ["t-pep", "Pepperoni", 250]] },
  removal("og", ["Pepperoni", "Sausage", "Mushrooms", "Olives", "Onions", "Green peppers", "Mozzarella"], "Mozzarella"),
  removal("sh", ["Pepperoni", "Sausage", "Ham", "Bacon", "Mozzarella"], "Mozzarella"),
  removal("pop", ["Jalapeño", "Bacon", "Cheddar"], "Cheddar"),
  removal("bbq", ["BBQ chicken", "Red onion", "Cilantro", "Mozzarella"], "Mozzarella"),
  removal("aloha", ["Ham", "Pineapple", "Mozzarella"], "Mozzarella"),
  removal("greek", ["Feta", "Olives", "Red onion", "Tomato", "Spinach"]),
  { id: "wing-sauce", name: "Sauce", kind: "choice", min: 1, max: 1, mods: [["red-hot", "Red Hot Buffalo", 0, { def: true }], ["daytona", "Daytona (mild)", 0], ["wing-bbq", "BBQ", 0]] },
  { id: "dip", name: "Dipping sauce", kind: "choice", min: 1, max: 1, mods: [["ranch", "Ranch", 0, { def: true }], ["honey-mustard", "Honey mustard", 0], ["dip-bbq", "BBQ", 0]] },
  { id: "popper-kind", name: "Kind", kind: "choice", min: 1, max: 1, mods: [["jalapeno-poppers", "Jalapeño", 0, { def: true }], ["mushroom-poppers", "Mushroom", 0]] },
  removal("killer", ["Bacon", "Ranch"]),
  removal("lethal", ["Bacon", "Jalapeños"]),
  removal("totchos", ["Onions", "Olives", "Jalapeños", "Tomatoes"]),
  { id: "add-chicken", name: "Add protein", kind: "addon", min: 0, max: 1, mods: [["add-chix", "Chicken", 400]] },
  { id: "philly-meat", name: "Meat", kind: "choice", min: 1, max: 1, mods: [["beef", "Beef", 0, { def: true }], ["chicken", "Chicken", 0]] },
  removal("philly", ["Onion", "Green pepper", "Mushroom"]),
  removal("greek-salad", ["Olives", "Onion", "Feta"]),
  { id: "dressing", name: "Dressing", kind: "choice", min: 1, max: 1, mods: [["d-ranch", "Ranch", 0, { def: true }], ["d-italian", "Italian", 0], ["d-bleu", "Bleu cheese", 0]] },
];

const pizza = (id: string, name: string, desc: string, rem: string, emoji = "🍕", tags: string[] = []) =>
  ({ id, cat: "pizza", name, desc, price: 900, emoji, groups: ["size", rem, "tops"], tags });
const ITEMS = [
  pizza("og", "OG Combo", "Pepperoni, sausage, mushrooms, olives, onions, green peppers", "og", "🍕", ["popular"]),
  pizza("slaughter", "Slaughter House", "Pepperoni, sausage, ham, bacon", "sh", "🥓"),
  pizza("popper", "Jalapeño Popper Pizza", "House popper sauce, jalapeño, bacon, cheddar", "pop", "🌶️", ["spicy", "new"]),
  pizza("bbq-chicken", "BBQ Chicken", "BBQ sauce, chicken, red onion, cilantro", "bbq"),
  pizza("aloha", "Aloha", "Ham and pineapple", "aloha", "🍍"),
  pizza("greek-pizza", "Greek", "Feta, olives, red onion, tomato, spinach", "greek", "🫒", ["vegetarian"]),
  { id: "wings", cat: "starters", name: "Chicken Wings (10)", desc: 'Homemade "Red hot" buffalo, Daytona (mild), or BBQ', price: 1595, emoji: "🍗", groups: ["wing-sauce"], tags: ["popular"] },
  { id: "killer", cat: "starters", name: "Killer Tots", desc: "Tots, mozzarella, cheddar, bacon, ranch for dipping", price: 1095, emoji: "🧀", groups: ["killer"], tags: [] },
  { id: "lethal", cat: "starters", name: "Lethal Tots", desc: "Killer Tots with jalapeños and extra heat", price: 1395, emoji: "🔥", groups: ["lethal"], tags: ["spicy"] },
  { id: "poppers", cat: "starters", name: "Poppers (10)", desc: "Jalapeño or mushroom, with bacon", price: 1095, emoji: "🌶️", groups: ["popper-kind"], tags: [] },
  { id: "nachos", cat: "starters", name: "Nachos", desc: "Chips, cheese, jalapeños, salsa, sour cream", price: 1150, emoji: "🌮", groups: ["add-chicken"], tags: [] },
  { id: "tenders", cat: "starters", name: "Chicken Tenders (4)", desc: "With your choice of dip", price: 900, emoji: "🍗", groups: ["dip"], tags: [] },
  { id: "totchos", cat: "starters", name: "Tot-Cho's", desc: "Tots loaded nacho-style", price: 1395, emoji: "🥔", groups: ["totchos"], tags: [] },
  { id: "cheesier-bread", cat: "starters", name: "Cheesier Bread", desc: "Garlic butter, mozzarella, marinara", price: 800, emoji: "🧄", groups: [], tags: [] },
  { id: "mozz-sticks", cat: "starters", name: "Mozzarella Sticks (6)", desc: "With marinara", price: 995, emoji: "🧀", groups: [], tags: [] },
  { id: "house-salad", cat: "salads", name: "House Salad", desc: "Greens, tomato, cucumber, croutons", price: 895, emoji: "🥗", groups: ["dressing", "add-chicken"], tags: ["vegetarian"] },
  { id: "greek-salad", cat: "salads", name: "Greek Salad", desc: "Olives, onion, feta, cucumber, tomato", price: 1050, emoji: "🥗", groups: ["greek-salad", "add-chicken"], tags: ["vegetarian"] },
  { id: "caesar", cat: "salads", name: "Caesar Salad", desc: "Romaine, parmesan, croutons", price: 950, emoji: "🥗", groups: ["add-chicken"], tags: [] },
  { id: "philly", cat: "salads", name: "Philly (w/ fries)", desc: "Beef or chicken, onion, green pepper, mushroom", price: 1495, emoji: "🥪", groups: ["philly-meat", "philly"], tags: [] },
  { id: "draft", cat: "drinks", name: "Draft & bottled beer", desc: "Domestic, import and premium — ask your bartender", price: 600, emoji: "🍺", groups: [], tags: ["21+"], online: false },
  { id: "seltzer", cat: "drinks", name: "White Claw / Truly", desc: "Hard seltzers", price: 700, emoji: "🥤", groups: [], tags: ["21+"], online: false },
  { id: "soda", cat: "drinks", name: "Fountain soda", desc: "Coke, Diet Coke, Sprite, lemonade", price: 300, emoji: "🥤", groups: [], tags: [] },
];

const PAGES: (typeof s.pages.$inferInsert)[] = [
  { slug: "play", title: "Play at The Hood", subtitle: "Live music bookings", kind: "form", requestType: "band", footerColumn: "host", submitLabel: "Send booking request",
    bodyHtml: "<p>We host live bands every Friday and Saturday night, plus showcases for local acts. Rock, country, Latin, covers, tributes — if it gets people moving, we want to hear it.</p><p>Tell us about your act and we'll get back to you within a week.</p>",
    formSchema: [
      { key: "band", label: "Band / artist name", type: "text", required: true }, { key: "name", label: "Contact name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true }, { key: "phone", label: "Phone", type: "tel" },
      { key: "genre", label: "Genre", type: "select", required: true, options: ["Rock", "Country", "Latin", "Hip-hop", "Tribute / covers", "Acoustic", "Other"] },
      { key: "links", label: "Links (Spotify, YouTube, Instagram)", type: "text" }, { key: "dates", label: "Preferred dates", type: "text" },
      { key: "about", label: "Tell us about your act", type: "textarea" }] },
  { slug: "private-events", title: "Private Events & Rentals", subtitle: "Birthdays, parties, corporate, watch parties", kind: "form", requestType: "private", footerColumn: "host", submitLabel: "Request a quote",
    bodyHtml: "<p>Rent the patio, the pool room, or the whole bar. We handle pizza, drinks and the music — you bring the people.</p><ul><li><b>Patio</b> · up to 40 guests</li><li><b>Pool room</b> · up to 25 guests</li><li><b>Full buyout</b> · up to 150 guests</li></ul>",
    formSchema: [
      { key: "name", label: "Your name", type: "text", required: true }, { key: "email", label: "Email", type: "email", required: true }, { key: "phone", label: "Phone", type: "tel", required: true },
      { key: "type", label: "Event type", type: "select", required: true, options: ["Birthday", "Corporate", "Fundraiser", "Bachelor / bachelorette", "Watch party", "Other"] },
      { key: "date", label: "Event date", type: "date", required: true }, { key: "guests", label: "Guest count", type: "number", required: true },
      { key: "space", label: "Space", type: "select", options: ["Patio", "Pool room", "Full buyout", "Not sure yet"] },
      { key: "notes", label: "Anything else?", type: "textarea" }] },
  { slug: "catering", title: "Catering", subtitle: "Pizza for your office, party or team", kind: "form", requestType: "catering", footerColumn: "host", submitLabel: "Request a quote",
    bodyHtml: "<p>Feed the crew. Whole pies, wings and tots, ready for pickup or dropped off around the Coachella Valley.</p>",
    formSchema: [
      { key: "name", label: "Your name", type: "text", required: true }, { key: "company", label: "Company (optional)", type: "text" },
      { key: "email", label: "Email", type: "email", required: true }, { key: "phone", label: "Phone", type: "tel", required: true },
      { key: "date", label: "Date needed", type: "date", required: true }, { key: "headcount", label: "Headcount", type: "number", required: true },
      { key: "delivery", label: "Pickup or drop-off", type: "select", options: ["Pickup", "Drop-off", "Not sure yet"] },
      { key: "notes", label: "What are you thinking?", type: "textarea" }] },
  { slug: "jobs", title: "Work at The Hood", subtitle: "Now hiring", kind: "form", requestType: "jobs", footerColumn: "explore", submitLabel: "Submit application",
    bodyHtml: "<p>Fun crew, late nights, live music. We're looking for people who like people.</p><ul><li><b>Bartender</b> · nights &amp; weekends · 21+</li><li><b>Pizza cook</b> · full or part time</li><li><b>Door / security</b> · Fri &amp; Sat</li></ul>",
    formSchema: [
      { key: "name", label: "Full name", type: "text", required: true }, { key: "email", label: "Email", type: "email", required: true }, { key: "phone", label: "Phone", type: "tel", required: true },
      { key: "position", label: "Position", type: "select", required: true, options: ["Bartender", "Pizza cook", "Server", "Door / security", "Any"] },
      { key: "availability", label: "Availability", type: "select", options: ["Nights", "Weekends", "Nights & weekends", "Open availability"] },
      { key: "over21", label: "Are you 21 or older?", type: "select", required: true, options: ["Yes", "No"] },
      { key: "why", label: "Why The Hood?", type: "textarea" }] },
  { slug: "privacy", title: "Privacy Policy", kind: "legal", bodyHtml: legal("privacy") },
  { slug: "terms", title: "Terms of Service", kind: "legal", bodyHtml: legal("terms") },
];

function legal(kind: "privacy" | "terms") {
  const n = restaurant.name;
  const note = `<p class="note">Template — needs review by the owner's lawyer before launch.</p>`;
  if (kind === "privacy")
    return `${note}<h2>What we collect</h2><p>When you order, we collect your name, phone, email and order details. Payments are handled by Stripe; ${n} never sees or stores your full card number.</p>
<h2>Phone orders</h2><p>Calls to our ordering line may be recorded and transcribed to take your order accurately. You'll hear a notice at the start of each call.</p>
<h2>Email</h2><p>We only send marketing email if you opt in. Every email has an unsubscribe link.</p>
<h2>Your California privacy rights</h2><p>You can ask what personal information we hold about you, ask us to delete it, and opt out of its sale or sharing (we don't sell it). Contact us at the address below.</p>
<h2>Contact</h2><p>${n}, ${restaurant.address}.</p>`;
  return `${note}<h2>Ordering</h2><p>Prices and availability can change without notice. Orders are confirmed when payment succeeds.</p>
<h2>Pickup</h2><p>We hold orders for 30 minutes after the ready time.</p>
<h2>Alcohol</h2><p>Alcohol is dine-in only, for guests 21 and over with valid ID, and is not sold online.</p>
<h2>Events &amp; private bookings</h2><p>Deposits and cancellation terms are confirmed in writing for each booking.</p>
<h2>Governing law</h2><p>These terms are governed by California law.</p>`;
}

/** YYYY-MM-DD of this week's Monday in the restaurant's timezone. */
export function mondayOf(d = new Date()) {
  const local = new Date(d.toLocaleString("en-US", { timeZone: restaurant.timezone }));
  const dow = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - dow);
  return ymd(local);
}
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(s.brand);
  if (n > 0) return;

  await db.insert(s.brand).values({ id: "brand", name: restaurant.name, settings: { theme: restaurant.theme, shortName: restaurant.shortName, domain: restaurant.domain, slug: restaurant.slug } });
  await db.insert(s.locations).values({ id: LOC, name: "Hwy 111", address: restaurant.address, phone: restaurant.phone, timezone: restaurant.timezone, ...restaurant.location });
  await db.insert(s.locationHours).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ locationId: LOC, weekday, opensAt: "14:00", closesAt: "02:00" })));

  // menu
  await db.insert(s.categories).values([
    { id: "pizza", name: "Pizza", sort: 1 }, { id: "starters", name: "Starters", sort: 2 },
    { id: "salads", name: "Salads & sandwiches", sort: 3 }, { id: "drinks", name: "Drinks", sort: 4 },
  ]);
  for (const g of GROUPS) {
    await db.insert(s.modifierGroups).values({ id: g.id, name: g.name, kind: g.kind, minSelect: g.min, maxSelect: g.max });
    await db.insert(s.modifiers).values(g.mods.map(([id, name, price, o], i) => ({ id, groupId: g.id, name, priceCents: price, isDefault: !!o?.def, extraPriceCents: o?.extra ?? null, sort: i })));
  }
  for (const [i, it] of ITEMS.entries()) {
    await db.insert(s.items).values({ id: it.id, categoryId: it.cat, name: it.name, description: it.desc, emoji: it.emoji, basePriceCents: it.price, tags: it.tags, orderableOnline: (it as { online?: boolean }).online ?? true, sort: i });
    if (it.groups.length) await db.insert(s.itemModifierGroups).values(it.groups.map((groupId, sort) => ({ itemId: it.id, groupId, sort })));
  }
  await db.insert(s.featuredItems).values([
    { itemId: "popper", badge: "NEW", blurb: "House popper sauce on a scratch crust", sort: 1 },
    { itemId: "og", badge: "STAFF PICK", blurb: "The one that started it all", sort: 2 },
    { itemId: "wings", badge: "HAPPY HOUR", blurb: "Try them Daytona-style (mild)", sort: 3 },
    { itemId: "killer", badge: "FAN FAVE", blurb: "Bar food, perfected", sort: 4 },
  ]);

  // events (weekly ones recur from their first date)
  const mon = mondayOf();
  await db.insert(s.events).values([
    { title: "👑 Drag Queen Bingo", description: "Prizes, laughs, and a full house", category: "Bingo", date: addDays(mon, 1), startTime: "20:00", repeat: "weekly" },
    { title: "🎤 Karaoke Night", description: "Sign-up at the bar", category: "Karaoke", date: addDays(mon, 3), startTime: "21:00", repeat: "weekly" },
    { title: "🎸 Live Music: Halloween Bash", description: "Costume contest at midnight", category: "Live music", date: "2026-10-31", startTime: "21:00" },
    { title: "👑 Sunday Bingo", description: "Hosted by our resident diva", category: "Bingo", date: addDays(mon, 6), startTime: "16:00", repeat: "weekly", showOnHome: false },
    { title: "🎸 Local Band Showcase", description: "Now booking acts", category: "Live music", date: "2026-11-14", startTime: "20:00", linkPageSlug: "play" },
  ]);

  // pages + sample requests
  const inserted = await db.insert(s.pages).values(PAGES).returning({ id: s.pages.id, slug: s.pages.slug });
  const pid = (slug: string) => inserted.find((p) => p.slug === slug)!.id;
  await db.insert(s.formSubmissions).values([
    { pageId: pid("play"), submitterName: "The Desert Sons", submitterEmail: "desertsons@example.com", status: "New", data: { band: "The Desert Sons", genre: "Rock", dates: "A Saturday in November", about: "Four-piece desert rock" } },
    { pageId: pid("private-events"), submitterName: "Alicia R.", submitterEmail: "alicia@example.com", status: "Contacted", data: { type: "Birthday", date: "2026-11-15", guests: "40", space: "Patio" } },
    { pageId: pid("jobs"), submitterName: "Marco D.", submitterEmail: "marco@example.com", status: "New", data: { position: "Bartender", availability: "Nights & weekends", over21: "Yes" } },
    { pageId: pid("catering"), submitterName: "Desert Tech Co.", submitterEmail: "office@example.com", status: "New", data: { date: "2026-11-06", headcount: "30", delivery: "Drop-off" } },
  ]);
  await db.insert(s.subscribers).values(["sam@example.com", "lee@example.com", "maria@example.com", "joe@example.com"].map((email) => ({ email })));

  // four test accounts
  const hash = await hashPassword(TEST_PASSWORD);
  const userIds: Record<string, string> = {};
  for (const a of TEST_ACCOUNTS) {
    const uid = crypto.randomUUID();
    userIds[a.local] = uid;
    await db.insert(s.user).values({ id: uid, name: a.name, email: testEmail(a.local), emailVerified: true, role: a.role, isTestAccount: true });
    await db.insert(s.account).values({ id: crypto.randomUUID(), accountId: uid, providerId: "credential", userId: uid, password: hash });
  }

  // team (Alex = the employee@ test account)
  const team = [
    { key: "alex", name: "Alex M.", position: "Bartender", payRateCents: 1800, maxHoursWeek: 32, preferredWindow: "Night", avail: ["prefer", "prefer", "ok", "no", "prefer", "prefer", "ok"], userId: userIds.employee },
    { key: "jordan", name: "Jordan P.", position: "Cook", payRateCents: 2000, maxHoursWeek: 40, preferredWindow: "Either", avail: ["ok", "ok", "ok", "ok", "prefer", "prefer", "no"] },
    { key: "sam", name: "Sam R.", position: "Server", payRateCents: 1700, maxHoursWeek: 25, preferredWindow: "Day", avail: ["no", "ok", "prefer", "prefer", "ok", "ok", "prefer"] },
    { key: "taylor", name: "Taylor K.", position: "Bartender", payRateCents: 1800, maxHoursWeek: 30, preferredWindow: "Night", avail: ["ok", "no", "ok", "ok", "prefer", "prefer", "prefer"] },
    { key: "riley", name: "Riley D.", position: "Door", payRateCents: 1900, maxHoursWeek: 16, preferredWindow: "Night", avail: ["no", "no", "no", "ok", "prefer", "prefer", "no"] },
  ];
  const emp: Record<string, string> = {};
  for (const t of team) {
    const [row] = await db.insert(s.employees).values({ name: t.name, position: t.position, payRateCents: t.payRateCents, maxHoursWeek: t.maxHoursWeek, preferredWindow: t.preferredWindow, avail: t.avail, userId: t.userId ?? null }).returning({ id: s.employees.id });
    emp[t.key] = row.id;
  }
  const plan: [string, number, string, string][] = [
    ["alex", 0, "18:00", "02:00"], ["alex", 1, "18:00", "02:00"], ["alex", 4, "20:00", "02:00"], ["alex", 5, "20:00", "02:00"],
    ["jordan", 0, "14:00", "22:00"], ["jordan", 1, "14:00", "22:00"], ["jordan", 2, "14:00", "22:00"], ["jordan", 4, "16:00", "00:00"], ["jordan", 5, "16:00", "00:00"],
    ["sam", 2, "14:00", "20:00"], ["sam", 3, "14:00", "20:00"], ["sam", 6, "14:00", "20:00"],
    ["taylor", 2, "18:00", "02:00"], ["taylor", 3, "18:00", "02:00"], ["taylor", 6, "16:00", "00:00"],
    ["riley", 4, "21:00", "02:00"], ["riley", 5, "21:00", "02:00"],
  ];
  const posOf = Object.fromEntries(team.map((t) => [t.key, t.position]));
  const shiftRows = await db.insert(s.shifts).values(plan.map(([k, d, start, end]) => ({ weekStart: mon, employeeId: emp[k], date: addDays(mon, d), start, end, position: posOf[k] }))).returning();
  await db.insert(s.schedules).values({ weekStart: mon, status: "published", publishedAt: new Date() });
  const taylorSun = shiftRows.find((r) => r.employeeId === emp.taylor && r.date === addDays(mon, 6))!;
  await db.insert(s.timeOffRequests).values({ employeeId: emp.taylor, startsOn: addDays(mon, 6), endsOn: addDays(mon, 6), reason: "Family birthday" });
  await db.insert(s.shiftCoverRequests).values({ shiftId: taylorSun.id, fromEmployeeId: emp.taylor, note: "Family birthday" });

  // last week's time entries for timesheets
  const lastMon = addDays(mon, -7);
  const entries: [string, number, string, number][] = [
    ["alex", 0, "17:56", 8.2], ["alex", 1, "17:58", 8.1], ["alex", 4, "19:55", 6.2], ["alex", 5, "19:58", 6.4],
    ["jordan", 0, "13:58", 8.6], ["jordan", 1, "14:01", 8.4], ["jordan", 2, "13:55", 9.1], ["jordan", 4, "15:57", 8.5], ["jordan", 5, "16:00", 8.6],
    ["sam", 2, "14:02", 5.8], ["sam", 3, "13:59", 6.0], ["sam", 6, "14:00", 5.7],
    ["taylor", 2, "18:00", 8.0], ["taylor", 3, "17:59", 8.3], ["taylor", 6, "16:02", 8.5],
    ["riley", 4, "20:58", 5.4], ["riley", 5, "21:00", 5.3],
  ];
  await db.insert(s.timeEntries).values(entries.map(([k, d, t, hrs]) => {
    const inAt = new Date(`${addDays(lastMon, d)}T${t}:00-07:00`);
    return { employeeId: emp[k], clockInAt: inAt, clockOutAt: new Date(inAt.getTime() + hrs * 36e5), locationVerified: true, breaks: hrs > 6 && k !== "taylor" ? [{ start: new Date(inAt.getTime() + 4 * 36e5).toISOString(), end: new Date(inAt.getTime() + 4.5 * 36e5).toISOString() }] : [] };
  }));

  // sample orders: some live in the kitchen, some history for the customer test account
  const menu = await loadItemDefs(db);
  const mk = async (n: number, status: string, name: string, lines: [string, (sel: Record<string, { action: "choose" | "add" | "keep" | "remove"; qty?: "light" | "normal" | "extra"; place?: "whole" | "left" | "right" }>) => void][], minutesAgo: number, channel: "web" | "voice" = "web", userId?: string) => {
    const built = lines.map(([itemId, tweak]) => {
      const def = menu[itemId];
      const sel = defaultSelections(def);
      tweak(sel);
      return { def, sel, unit: priceLine(def, sel) };
    });
    const subtotal = built.reduce((a, b) => a + b.unit, 0);
    const tax = Math.round(subtotal * 0.0875);
    const tip = Math.round(subtotal * 0.15);
    const createdAt = new Date(Date.now() - minutesAgo * 60000);
    const [o] = await db.insert(s.orders).values({
      number: "A" + String(n).padStart(3, "0"), locationId: LOC, status, channel, customerName: name, customerPhone: "(555) 010-" + String(1000 + n).slice(1),
      customerEmail: userId ? testEmail("customer") : `${name.toLowerCase().split(" ")[0]}@example.com`, customerUserId: userId ?? null,
      subtotalCents: subtotal, taxCents: tax, tipCents: tip, totalCents: subtotal + tax + tip, paymentProvider: "demo", paymentRef: "demo_" + n,
      pickupAt: new Date(createdAt.getTime() + 20 * 60000), createdAt,
    }).returning({ id: s.orders.id });
    await db.insert(s.orderItems).values(built.map((b) => ({ orderId: o.id, itemId: b.def.id, nameSnapshot: b.def.name, unitPriceCents: b.unit, quantity: 1, lineTotalCents: b.unit, selections: b.sel, modifiersText: describeSelections(b.def, b.sel).map((d) => d.label) })));
  };
  const cust = userIds.customer;
  await mk(31, "completed", "Jamie Customer", [["og", (x) => { delete x.slice; x.whole = { action: "choose" }; x["og-sausage"] = { action: "remove" }; x["t-jal"] = { action: "add", qty: "normal", place: "whole" }; }]], 60 * 24 * 3, "web", cust);
  await mk(7, "completed", "Jamie Customer", [["wings", (x) => { delete x["red-hot"]; x.daytona = { action: "choose" }; }], ["killer", () => {}]], 60 * 24 * 10, "web", cust);
  await mk(39, "ready", "Lee", [["cheesier-bread", () => {}]], 25);
  await mk(40, "preparing", "Sam", [["popper", (x) => { x["pop-bacon"] = { action: "remove" }; }], ["killer", () => {}]], 15);
  await mk(42, "paid", "Joe", [["og", (x) => { delete x.slice; x.whole = { action: "choose" }; x["og-sausage"] = { action: "remove" }; x["t-onion"] = { action: "add", qty: "normal", place: "whole" }; }], ["philly", () => {}]], 4, "voice");
  await mk(43, "paid", "Maria", [["slaughter", (x) => { delete x.slice; x.whole = { action: "choose" }; x["t-pine"] = { action: "add", qty: "normal", place: "left" }; }], ["wings", () => {}]], 2);
}

/** Item definitions with modifier groups, in the shape the pricing functions take. */
export async function loadItemDefs(db: Db): Promise<Record<string, ItemDef>> {
  const [its, links, groups, mods] = await Promise.all([
    db.select().from(s.items), db.select().from(s.itemModifierGroups), db.select().from(s.modifierGroups), db.select().from(s.modifiers),
  ]);
  const out: Record<string, ItemDef> = {};
  for (const it of its) {
    const gl = links.filter((l) => l.itemId === it.id).sort((a, b) => a.sort - b.sort);
    out[it.id] = {
      id: it.id, name: it.name, basePriceCents: it.basePriceCents,
      groups: gl.map((l) => {
        const g = groups.find((x) => x.id === l.groupId)!;
        return { id: g.id, name: g.name, kind: g.kind, min: g.minSelect, max: g.maxSelect,
          mods: mods.filter((m) => m.groupId === g.id).sort((a, b) => a.sort - b.sort).map((m) => ({ id: m.id, name: m.name, priceCents: m.priceCents, extraPriceCents: m.extraPriceCents, isDefault: m.isDefault })) };
      }),
    };
  }
  return out;
}
