# 05 — Owner & Staff Dashboard

Lives at `/admin`. Mobile-friendly, but the kitchen screen is designed for a tablet.

## Roles

Full matrix in [13-accounts-roles](13-accounts-roles.md). In short:

| Role | Can |
|---|---|
| **webmaster** | Everything an owner can (except pay rates), plus Webmaster tools: domain, integrations, payment mode, feature flags, backups |
| **owner** | Everything business-side: menu, pages, events, requests, schedule, payroll, payments, team |
| **manager** (optional) | Menu, events, requests, schedule, orders and refunds for their location(s); no payroll or settings |
| **kitchen** (shared tablet) | Kitchen screen and 86 board only |
| **staff** | Staff portal (see below) |

`memberships.location_id` null = all locations (chain owners). Every server action calls
`requireRole(role, locationId)`.

Login: email + password at `/login` (Google and Facebook added at launch, see [13](13-accounts-roles.md)). Owners invite staff by text or email; the kitchen tablet uses the kitchen account or a one-time pairing code.

## Navigation

Mobile: a **bottom tab bar** like the customer site — Home · Kitchen · Schedule · Events · **More**.
More lists everything else (**Requests**, Menu & 86 board, Timesheets, Team & access, Pages & forms,
Newsletter, Orders & refunds, Phone calls, Promo codes, Reports, Hours, Settings) and carries
an unread badge for new requests. The Home dashboard also shows new requests and shift
cover requests waiting for approval. Desktop: the same items as a top nav.

The **kitchen tablet** gets its own bar: Orders · 86 board.

Employees (staff role) get the **staff portal** instead: Schedule · Clock · Availability (with shift cover), plus
Kitchen and the 86 board if the owner allows it. See [12-staff-scheduling](12-staff-scheduling.md).

## Screens

| Screen | What it does |
|---|---|
| **Home** | Today's sales, order count, average ticket, open orders, store status toggle (open / busy / paused) |
| **Kitchen** | Live columns: New → Preparing → Ready. Big tap targets, sound + flash on new order, ticket shows modifiers grouped (ADD / NO / EXTRA / HALF), allergy flags in red, prep timer. Works offline-tolerant (reconnects SSE) |
| **Orders** | Search/filter all orders, detail view, refund (full/partial), resend receipt, print ticket |
| **Menu** | Categories (drag to sort), items (photo upload, price, tags), modifier groups (reusable), per-location overrides, **86 toggle** with "until end of day" |
| **Hours** | Weekly hours, split shifts, holiday closures, pickup lead time, slot capacity |
| **Home page** | Pick featured items for the "Specials & new" carousel, set badge/blurb/schedule, drag to sort |
| **Events** | Add one-off or weekly events (bingo, live music, karaoke) with image and optional sign-up button; shown on home and `/events` ([11](11-content-pages.md)) |
| **Schedule** | Week grid builder with availability shading, live conflict/overtime warnings, labor cost, time-off and shift-cover approvals, publish & notify ([12](12-staff-scheduling.md)) |
| **Timesheets** | Who's on the clock, worked vs scheduled hours, break/overtime flags, edits with reasons, approve, payroll CSV or **Send to Gusto** (optional, [14](14-payroll-deposits.md)) |
| **Team & access** | Invite employees by text/email, positions, pay rates (owner only), deactivate; add owners/managers; pair or unpair kitchen tablets |
| **Requests** | One inbox for every form: bands, private events, catering, job applications. Filter by type, track status (New → Quoted → Deposit paid → Booked), reply, send a deposit link, turn a band into an event ([11](11-content-pages.md)) |
| **Pages & forms** | Build one-off pages (band booking, private events, jobs), edit legal pages, read and track submissions ([11](11-content-pages.md)) |
| **Promos** | Create/end promo codes, usage stats |
| **Customers** | List, order history, marketing opt-in status |
| **Newsletter** | Subscribers, compose campaign, schedule, results ([06](06-email-newsletter.md)) |
| **Calls** | Voice call log, outcome, transcript link, linked order |
| **Reports** | Sales by day/item/channel, modifier popularity, CSV export |
| **Settings** | Brand info, payments (Connect onboarding or key status), tax, tips, feature flags, staff & roles, locations (chain) |

## Kitchen ticket format

```
#A042  PICKUP 6:30 PM   (voice)        Joe · 555-0134
──────────────────────────────────
1× LG PEPPERONI
   NO  Sausage
   ADD Onions
   EXTRA Cheese
   HALF(L) Mushrooms
2× GARLIC KNOTS
⚠ ALLERGY: nut allergy — note from caller
```

## Later

Receipt printer support (Star CloudPRNT / Epson ePOS) and a "bump bar" keyboard shortcut mode.
