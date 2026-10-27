import { boolean, integer, jsonb, pgTable, primaryKey, real, serial, text, timestamp } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ───────── Auth (Better Auth tables) ─────────
// role: admin (owner) | manager | employee | kitchen | customer. Webmaster comes from env.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("customer"),
  isTestAccount: boolean("is_test_account").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ───────── Brand & locations ─────────
export const brand = pgTable("brand", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  timezone: text("timezone").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  taxRate: real("tax_rate").notNull().default(0.0875),
  pickupLeadMinutes: integer("pickup_lead_minutes").notNull().default(20),
  busy: boolean("busy").notNull().default(false),
  orderingPaused: boolean("ordering_paused").notNull().default(false),
  deliveryPaused: boolean("delivery_paused").notNull().default(false),
});

export const locationHours = pgTable("location_hours", {
  id: serial("id").primaryKey(),
  locationId: text("location_id").notNull().references(() => locations.id),
  weekday: integer("weekday").notNull(),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at").notNull(),
});

// ───────── Menu ─────────
export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  // menu times this category is served in (breakfast, lunch…); empty = whenever the store is open
  daypartIds: text("daypart_ids").array().notNull().default([]),
});

// Breakfast / lunch / dinner windows. endsAt <= startsAt runs past midnight (late night).
export const dayparts = pgTable("dayparts", {
  id: id(),
  name: text("name").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  days: integer("days").array().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  sort: integer("sort").notNull().default(0),
});

export const items = pgTable("items", {
  id: id(),
  categoryId: text("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("🍽️"),
  imageUrl: text("image_url"),
  // photo carousel on the menu, first one is the thumbnail ("/media/<id>" uploads or https links)
  images: text("images").array().notNull().default([]),
  basePriceCents: integer("base_price_cents").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  orderableOnline: boolean("orderable_online").notNull().default(true),
  soldOutUntil: timestamp("sold_out_until", { withTimezone: true }),
  tags: text("tags").array().notNull().default([]),
  kitchenName: text("kitchen_name"),
  voiceAliases: text("voice_aliases").array().notNull().default([]),
  sort: integer("sort").notNull().default(0),
});

export const modifierGroups = pgTable("modifier_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").$type<"choice" | "addon" | "removal" | "option">().notNull(),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
});

export const modifiers = pgTable("modifiers", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => modifierGroups.id),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  extraPriceCents: integer("extra_price_cents"),
  isDefault: boolean("is_default").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  voiceAliases: text("voice_aliases").array().notNull().default([]),
});

export const itemModifierGroups = pgTable(
  "item_modifier_groups",
  {
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    groupId: text("group_id").notNull().references(() => modifierGroups.id),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.groupId] })],
);

export const featuredItems = pgTable("featured_items", {
  id: id(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  badge: text("badge").notNull(),
  blurb: text("blurb").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

// ───────── Orders ─────────
export const orders = pgTable("orders", {
  id: id(),
  number: text("number").notNull(),
  locationId: text("location_id").notNull(),
  customerUserId: text("customer_user_id"),
  channel: text("channel").$type<"web" | "voice" | "admin">().notNull().default("web"),
  status: text("status").notNull().default("pending_payment"),
  pickupAt: timestamp("pickup_at", { withTimezone: true }),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull(),
  tipCents: integer("tip_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  notes: text("notes"),
  paymentProvider: text("payment_provider"),
  paymentRef: text("payment_ref"),
  // delivery: the driver comes from DoorDash Drive / Uber Direct (or the demo driver)
  fulfillment: text("fulfillment").$type<"pickup" | "delivery">().notNull().default("pickup"),
  deliveryAddress: jsonb("delivery_address").$type<import("../domain/delivery").DeliveryAddress>(),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  deliveryQuoteRef: text("delivery_quote_ref"), // settings_kv "dq:<ref>": the quote the customer accepted
  delivery: jsonb("delivery").$type<import("../domain/delivery").DeliveryRecord>(),
  createdAt: created(),
});

// What customers see on their dashboard and as phone notifications ("Your order is in the oven").
export const notifications = pgTable("notifications", {
  id: id(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  url: text("url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
});

// Phones and browsers that asked for order alerts (Web Push). Guests subscribe per order.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(), // hash of endpoint + owner, so re-subscribing doesn't duplicate
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userId: text("user_id"),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  createdAt: created(),
});

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  nameSnapshot: text("name_snapshot").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
  selections: jsonb("selections").notNull(),
  modifiersText: text("modifiers_text").array().notNull().default([]),
  instructions: text("instructions"),
});

export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorUserId: text("actor_user_id"),
  at: created(),
});

// ───────── Content ─────────
export const events = pgTable("events", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Other"),
  date: text("date").notNull(), // YYYY-MM-DD of first occurrence
  startTime: text("start_time"),
  repeat: text("repeat").$type<"" | "weekly" | "monthly">().notNull().default(""),
  linkPageSlug: text("link_page_slug"),
  showOnHome: boolean("show_on_home").notNull().default(true),
  cancelledDates: text("cancelled_dates").array().notNull().default([]),
});

export interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "email" | "tel" | "date" | "number" | "select" | "file";
  required?: boolean;
  options?: string[];
}

export const pages = pgTable("pages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  kind: text("kind").$type<"form" | "legal" | "landing" | "blank">().notNull(),
  requestType: text("request_type"), // band | private | catering | jobs
  status: text("status").$type<"draft" | "published">().notNull().default("published"),
  bodyHtml: text("body_html").notNull().default(""),
  formSchema: jsonb("form_schema").$type<FormField[]>(),
  submitLabel: text("submit_label").notNull().default("Send"),
  footerColumn: text("footer_column"),
  notifyEmail: text("notify_email"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: id(),
  pageId: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  status: text("status").notNull().default("New"),
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  depositCents: integer("deposit_cents"),
  createdAt: created(),
});

export const subscribers = pgTable("subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("active"),
  source: text("source").notNull().default("site"),
  createdAt: created(),
});

export const campaigns = pgTable("campaigns", {
  id: id(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  sentCount: integer("sent_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: created(),
});

/** Demo inbox / outbox: every email the app would send. In live mode a worker delivers via Resend. */
export const emails = pgTable("emails", {
  id: id(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("captured"),
  createdAt: created(),
});

// ───────── Staff ─────────
export const employees = pgTable("employees", {
  id: id(),
  userId: text("user_id").references(() => user.id),
  name: text("name").notNull(),
  phone: text("phone"),
  position: text("position").notNull(),
  payRateCents: integer("pay_rate_cents").notNull().default(1650),
  maxHoursWeek: integer("max_hours_week").notNull().default(32),
  preferredWindow: text("preferred_window").notNull().default("Either"),
  avail: text("avail").array().notNull().default(["ok", "ok", "ok", "ok", "ok", "ok", "ok"]),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("active"),
});

export const staffInvites = pgTable("staff_invites", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  position: text("position").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: created(),
});

export const timeOffRequests = pgTable("time_off_requests", {
  id: id(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").$type<"pending" | "approved" | "denied">().notNull().default("pending"),
  createdAt: created(),
});

export const schedules = pgTable("schedules", {
  weekStart: text("week_start").primaryKey(), // Monday YYYY-MM-DD
  status: text("status").$type<"draft" | "published" | "changed">().notNull().default("published"),
  publishedAt: timestamp("published_at"),
});

export const shifts = pgTable("shifts", {
  id: id(),
  weekStart: text("week_start").notNull(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  date: text("date").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  position: text("position").notNull(),
});

export const shiftCoverRequests = pgTable("shift_cover_requests", {
  id: id(),
  shiftId: text("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  fromEmployeeId: text("from_employee_id").notNull(),
  claimedByEmployeeId: text("claimed_by_employee_id"),
  note: text("note").notNull().default(""),
  status: text("status").$type<"open" | "claimed" | "approved" | "denied" | "cancelled">().notNull().default("open"),
  createdAt: created(),
});

export const timeEntries = pgTable("time_entries", {
  id: id(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  breaks: jsonb("breaks").$type<{ start: string; end?: string }[]>().notNull().default([]),
  method: text("method").notNull().default("app"),
  locationVerified: boolean("location_verified").notNull().default(false),
  approvedAt: timestamp("approved_at"),
});

// Uploaded logos, app icons and banners, served from /media/<id>. Small images only (resized in
// the browser before upload), so they live in the database and every clone needs no file storage.
export const media = pgTable("media", {
  id: id(),
  mime: text("mime").notNull(),
  data: text("data").notNull(), // base64
  width: integer("width"),
  height: integer("height"),
  createdAt: created(),
});

export const settingsKv = pgTable("settings_kv", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
});
