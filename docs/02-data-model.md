# 02 — Data Model

Postgres on Neon, defined in Drizzle. Money is **integer cents**. Times are `timestamptz`;
display uses the location's timezone. IDs are text ULIDs/UUIDs.

## Entity map

```
brand (1 row) ─┬─ locations ─┬─ location_hours / closures
               │             ├─ location_item_overrides ── items
               │             ├─ location_modifier_overrides ── modifiers
               │             └─ orders ── order_items ── order_item_modifiers
               │
               ├─ categories ── category_items ── items ── item_modifier_groups ── modifier_groups ── modifiers
               │
               ├─ users ── memberships (role, location scope)
               ├─ customers ── saved_carts / favorites
               ├─ promo_codes
               ├─ subscribers ── campaigns ── campaign_sends
               └─ payment_accounts (Connect account id or direct-key reference)
```

## Locations (chain-ready)

| Table | Key columns |
|---|---|
| `brand` | `id, name, slug, settings jsonb` (single row per deploy) |
| `locations` | `id, name, slug, address, phone, timezone, lat, lng, is_active, pickup_lead_minutes, max_orders_per_slot, slot_minutes, tax_rate_override, payment_account_id` |
| `location_hours` | `location_id, weekday (0–6), opens_at, closes_at` — multiple rows per day allowed (lunch/dinner split); `closes_at <= opens_at` means it closes the **next day** (e.g. 2 PM–2 AM bars) |
| `location_closures` | `location_id, starts_at, ends_at, reason` — holidays, emergencies |

A single-location restaurant has exactly one `locations` row, created by the seed.

## Menu

| Table | Key columns |
|---|---|
| `categories` | `id, name, sort, is_visible` |
| `items` | `id, name, description, base_price_cents, image_url, is_active, orderable_online (false = display only, e.g. alcohol), tags text[]` (spicy, vegan, gf), `kitchen_name` (short name for tickets) |
| `category_items` | `category_id, item_id, sort` — an item can appear in multiple categories |
| `modifier_groups` | `id, name, kind, min_select, max_select, free_quantity, sort` |
| `modifiers` | `id, group_id, name, price_cents, is_default, sort, is_active, voice_aliases text[]` |
| `item_modifier_groups` | `item_id, group_id, sort, overrides jsonb` — reuse groups across items |
| `location_item_overrides` | `location_id, item_id, price_cents?, is_available, sold_out_until?` |
| `location_modifier_overrides` | `location_id, modifier_id, price_cents?, is_available` |

### Modifier group `kind`

| kind | Example | Rules |
|---|---|---|
| `choice` | Size: Small / Medium / Large | usually `min=1, max=1`; may change base price |
| `addon` | Toppings: +Onions, +Mushrooms | `min=0, max=N`; `free_quantity` covers "first 2 free" |
| `removal` | Comes with: Sausage, Peppers | defaults pre-selected; customer can **remove** (price 0) — "hold the sausage" |
| `option` | Crust: Thin / Regular / Deep | like `choice`, price deltas allowed |

### Per-selection qualifiers

Each selected modifier on an order line also carries:

- `quantity` — `light` (0.5) / `normal` (1) / `extra` (2); extra charges `price_cents` again (or a configurable `extra_price_cents`)
- `placement` — `whole` / `left` / `right` for half-and-half pizza; halves charge a configurable share

Size-dependent topping prices (e.g. +$1 small, +$2 large) are handled by
`modifiers.price_by_choice jsonb` keyed by the size modifier id.

## Orders

| Table | Key columns |
|---|---|
| `orders` | `id, number (short, per location/day), location_id, customer_id?, channel (web/voice/admin), status, fulfillment (pickup/delivery), pickup_at, subtotal_cents, discount_cents, tax_cents, tip_cents, fee_cents, total_cents, promo_code_id?, customer_name, customer_phone, customer_email, notes, payment_status, payment_provider, payment_ref, created_at` |
| `order_items` | `id, order_id, item_id, name_snapshot, kitchen_name_snapshot, unit_price_cents, quantity, line_total_cents, special_instructions` |
| `order_item_modifiers` | `order_item_id, modifier_id, group_name_snapshot, name_snapshot, action (add/remove/choose), quantity_level, placement, price_cents` |
| `order_events` | `order_id, from_status, to_status, actor_user_id?, at` — audit trail |

### Order status machine

```
draft ──► pending_payment ──► paid ──► accepted ──► preparing ──► ready ──► completed
  │              │                │                                          
  │              └──► expired     └──► refunded / partially_refunded         
  └──► (voice: pay_at_pickup) ──► accepted ...                 any ──► cancelled
```

Transitions only happen in `src/domain/orders.ts`. Each one writes an `order_events` row and
may enqueue an email/push in `outbox`.

## People

| Table | Key columns |
|---|---|
| `users` | Better Auth tables (`user, session, account, verification`) |
| `memberships` | `user_id, role (owner/manager/staff), location_id?, kitchen_access` — null location = all locations. Webmaster comes from env; kitchen tablets are `devices` ([13](13-accounts-roles.md)) |
| `devices` | `id, location_id, name, kind (kitchen/kiosk), paired_at, last_seen_at, revoked_at?` |
| `audit_log` | `actor, action, target, before, after, at` — every admin/webmaster change |
| `customers` | `id, user_id?, email, phone, name, marketing_opt_in, stripe_customer_id?` — guests are customers without a user |
| `favorites` | `customer_id, item_id, selections jsonb` |

## Marketing

| Table | Key columns |
|---|---|
| `promo_codes` | `code, type (percent/amount/free_item), value, min_subtotal_cents, starts_at, ends_at, max_uses, uses, location_id?` |
| `subscribers` | `id, email, status (pending/active/unsubscribed/bounced), source, confirmed_at, location_id?, tags text[]` |
| `campaigns` | `id, subject, preheader, body_json, status (draft/scheduled/sending/sent), scheduled_at, audience_filter jsonb` |
| `campaign_sends` | `campaign_id, subscriber_id, resend_id, status, opened_at, clicked_at` |
| `featured_items` | `id, item_id, badge (NEW / STAFF PICK / HAPPY HOUR…), blurb, sort, starts_at?, ends_at?, location_id?` — home page "Specials & new" carousel |
| `events` (optional feature) | `id, location_id, title, description, category, starts_at, ends_at, recurrence_rule?, image_url, link_page_id?, link_url?, show_on_home, cancelled_dates date[]` — live music, bingo, karaoke |

## Staff scheduling & time clock

`employees`, `staff_invites`, `availability`, `time_off_requests`, `schedules`, `shifts`,
`time_entries`, `shift_cover_requests`, `labor_rules`, optional `payroll_connections` / `payroll_syncs` — full columns in [12-staff-scheduling](12-staff-scheduling.md).
Employees link to `users` (Better Auth) and get a `memberships` row with role `staff`.

## Content pages & forms

| Table | Key columns |
|---|---|
| `pages` | `id, slug (unique), title, subtitle, kind (form/legal/landing/blank), request_type (band/private/catering/jobs/other)?, status (draft/published), body_json (blocks), form_schema jsonb?, notify_email?, submit_label, footer_column (explore/host/null), is_system, legal_reviewed_at?, seo jsonb, updated_at` |
| `form_submissions` | `id, page_id, data jsonb, files text[] (private Blob URLs), status (per request type, e.g. new/quoted/deposit_paid/booked/declined), deposit_cents?, deposit_payment_ref?, submitter_email, ip_hash, created_at, delete_after?` |

`form_schema` = `[{ key, label, type, required, options?, help? }]`, validated with Zod built
from the schema on submit.

## Payments & infra

| Table | Key columns |
|---|---|
| `payment_accounts` | `id, mode (connect/direct), stripe_account_id?, secret_ref?, charges_enabled, payouts_enabled, platform_fee_bps` — secrets live in env vars; `secret_ref` names which one |
| `outbox` | `id, kind (email/push/sms/webhook), payload jsonb, status, attempts, run_after` |
| `push_subscriptions` | `customer_id?, endpoint, keys jsonb` |
| `voice_calls` | `retell_call_id, location_id, from_phone, order_id?, transcript_url, outcome, duration_s` |
| `settings_kv` | `key, value jsonb` — runtime toggles (pause online ordering, banner text) |

## Indexes worth having on day one

- `orders (location_id, status, pickup_at)` — kitchen screen
- `orders (customer_id, created_at desc)` — reorder
- `subscribers (email)` unique
- `modifiers using gin (voice_aliases)` — voice matching
