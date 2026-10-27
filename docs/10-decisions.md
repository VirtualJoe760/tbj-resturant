# 10 — Decision Log

Short records of why things are the way they are. Newest at the bottom.

### D1 — One deploy per restaurant brand (2026-10-26)
**Decision:** Each client gets its own repo fork, Vercel project, and Neon database.
**Why:** Target is small businesses. Separate deploys isolate data, billing, and failures, and
let a client leave with their own stack. No tenant-filtering bugs are possible across clients.
**Cost:** Template updates must be merged into each client repo; mitigated by keeping client
customization in config/brand/content only.

### D2 — Chain-ready from day one via `locations` (2026-10-26)
**Decision:** Every location-sensitive table has `location_id`. Menu is defined at the brand
level with optional per-location overrides (price, availability, hours).
**Why:** Lets a client grow from one shop to a chain inside the same deploy without a
migration that touches every table.
**Cost:** Slightly more joins; single-location UI hides the location picker.

### D3 — Stripe Connect default, bring-your-own-key optional (2026-10-26)
**Decision:** `PaymentProvider` interface with two implementations: `connect` (we are the
platform; restaurant has a connected Standard/Express account; optional platform fee) and
`direct` (restaurant's own secret key and webhook secret).
**Why:** Connect gives fast onboarding and a revenue path; some owners already have Stripe and
want to keep it.
**Cost:** Two code paths for checkout and webhooks; covered by shared contract tests.

### D4 — Single pricing function shared by web, voice, receipts (2026-10-26)
**Decision:** `src/domain/pricing.ts` is the only code that computes money. Prices are integer cents.
**Why:** The voice agent and website must never disagree on a total.

### D5 — Order lines snapshot names and prices (2026-10-26)
**Decision:** `order_items` and `order_item_modifiers` store the name and price at time of order.
**Why:** Editing the menu later must not change past receipts or reports.

### D6 — First client is The Hood Bar & Pizza (2026-10-26)
**Decision:** Build v1 against a real client profile ([clients/the-hood](clients/the-hood.md)).
It adds three template features: hours that cross midnight, an optional Events page, and
display-only (not orderable online) items for alcohol.
**Why:** A real bar-and-pizza menu forces the edge cases a demo menu wouldn't.

### D7 — Five account types; kitchen is a device, webmaster is env-defined (2026-10-27)
**Decision:** Roles are webmaster, owner, optional manager, kitchen, employee, plus optional
customer accounts ([13](13-accounts-roles.md)). Kitchen tablets sign in with a one-time
pairing code, not a person's login. The webmaster account comes from an environment variable.
**Why:** A shared tablet with someone's personal login leaks admin access to the whole line.
An env-defined webmaster can't be removed by mistake and is cleanly removed when a client leaves.

### D8 — Staff get paid through a payroll provider, never through Stripe (2026-10-27)
**Decision:** Optional Gusto connection sends approved hours; Gusto runs direct deposit, tax
withholding and filings. Stripe is only used to collect money (orders, deposits).
**Why:** Paying wages through Stripe would skip withholding and filings that California requires.

### D9 — Every client starts as a free demo; demos share one database (2026-10-27)
**Decision:** A private `create-restaurant` CLI builds a demo from a questionnaire (Google
listing, Yelp, website, or manual intake). Demos run the real app with `APP_MODE=demo`: one
shared Neon project with a schema per prospect, Stripe test mode, emails captured on-site.
Demos are projects on our existing Vercel Pro account.
`promote` creates the client's own repo, database and Stripe when they buy.
**Why:** Pitching several restaurants a day needs a site per prospect in minutes at no cost.
Running the real app (not a mock) means the pitch shows exactly what they'll get, and demos
pick up template improvements automatically.
**Cost:** Two config sources (database for demos, file for live). Yelp data needs its paid API;
we don't scrape it.

### D10 — Email + password first, four seeded test accounts, social sign-in last (2026-10-27)
**Decision:** Sign-in is email + password (Better Auth). Every site seeds admin@, employee@,
kitchen@ and customer@ test accounts with one shared test password. Google and Facebook
sign-in are added per client only after they sign, because each needs OAuth apps for the
client's own domain. Test accounts are disabled on live sites unless the webmaster turns them on.
**Why:** Fast testing and pitching of every role on any device; no OAuth setup for prospects.
