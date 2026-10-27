# 09 — Build Plan

Phases are ordered so each ends with something demoable. Rough sizes assume one developer
working with Claude Code.

## Status (2026-10-27, v1 running locally)

| Phase | Built | Still to do |
|---|---|---|
| 0 Foundations | Next.js, Drizzle schema + migrations, Neon or embedded Postgres, seed, Vitest | Vercel project, Sentry, Playwright, shadcn/ui (plain CSS used) |
| 1 Menu & cart | Pricing/cart/hours domain + tests, menu with item builder (light/extra/halves), cart, menu times (breakfast/lunch/dinner), item photo carousel | Search, pickup-slot throttling, order-ahead for a later menu time |
| 2 Checkout | `PaymentProvider` with demo + Stripe Checkout (connect/direct), webhook, live status page | Payment Element, promo codes, Stripe Tax; Stripe path untested without keys |
| 3 Admin & kitchen | Dashboard, store switches, kitchen board (3 s polling), 86 board, item editor, orders + refunds | Modifier-group editor, Stripe refund call, hours editor |
| 4 Email | All mail captured in Demo inbox (receipt, ready, refund, invites, forms) | Resend sending worker |
| 5 PWA & stores | Manifest (maskable icon, shortcuts), icons rendered from `business-theme.ts`, offline service worker, assetlinks / apple-app-site-association, `create-tbj-restaurant store` kit | Web Push, install prompt, Sign in with Apple, store screenshots |
| 6 Voice | `/api/voice/*` functions, spoken-modifier parser + tests | Retell agent setup, SMS payment link, call log |
| 7 Newsletter | Signup, compose + send (captured), sent list | Double opt-in, unsubscribe, scheduling |
| 7b Content | Footer, legal templates, events, page/form builder, requests inbox | File upload storage, Turnstile |
| 7c Staff | Invites, schedule builder + warnings, publish, time off, shift cover, clock + breaks, timesheets + CSV | Kiosk/PIN, texts/push, timesheet edits |
| 7d Payroll & deposits | Deposit-link email (placeholder link), Gusto button stub | Gusto API, real Stripe payment links |
| 8 Clone tooling | `create-tbj-restaurant` CLI (questionnaire, imports, AI menu + photos, menu times, logo/icon/photos/fonts/colors → `business-theme.ts`), `import-client`, Admin → Branding | Vercel deploy, demo schemas, `promote` |
| 9 Chain mode | `location_id` on orders/hours | Everything else |

## Phase 0 — Foundations (2–3 days)
- [ ] Next.js + TypeScript + Tailwind + shadcn/ui scaffold, ESLint/Prettier, Vitest, Playwright
- [ ] `restaurant.config.ts` loader with Zod validation; theme tokens → CSS variables
- [ ] Neon + Drizzle setup, full schema from [02-data-model](02-data-model.md), migrations
- [ ] Seed script with a demo pizza menu (exercises every modifier kind)
- [ ] Vercel project, preview deploys with Neon branch per preview
- [ ] Sentry

**Demo:** deployed empty shell themed from config.

## Phase 1 — Menu & cart (4–5 days)
- [ ] `domain/menu.ts`, `domain/cart.ts`, `domain/pricing.ts` with exhaustive unit tests
      (required groups, max selections, free quantity, extra/light, half placement, size-based prices, overrides)
- [ ] Menu page (categories, sticky category tabs, search), item bottom sheet, cart drawer
- [ ] Hours/open-closed, pickup slot generation + throttling

**Demo:** build a complex pizza on a phone and see the correct price.

## Phase 2 — Checkout & payments (4–5 days)
- [ ] `PaymentProvider` interface; `connect` and `direct` implementations
- [ ] Checkout page with Payment Element, tips, promo codes, tax
- [ ] Webhook handler (idempotent), order state machine, order status page (live)
- [ ] Contract tests run against both providers in Stripe test mode

**Demo:** real test-mode order paid with Apple Pay; order shows as paid.

## Phase 3 — Admin & kitchen (5–6 days)
- [ ] Better Auth email + password, `/login` with disabled Google/Facebook buttons; roles ([13](13-accounts-roles.md)): webmaster via env, owner, optional manager, staff; `requireRole` + audit log
- [ ] Seed the four test accounts (admin@, employee@, kitchen@, customer@)
- [ ] Kitchen tablet pairing (device code, long-lived session, unpair)
- [ ] Kitchen screen (SSE, sound alert, status buttons)
- [ ] Orders list/detail, refunds
- [ ] Menu editor incl. modifier groups, photos, 86 toggles, location overrides
- [ ] Hours, closures, busy mode, pause ordering
- [ ] Connect onboarding screen / direct-key status screen

**Demo:** owner edits the menu, a customer orders, kitchen bumps it to ready.

## Phase 3b — Demo mode & intake CLI: first pitchable version (5–6 days)
- [ ] `APP_MODE=demo`: config from DB, shared Neon project with schema per demo, banner, noindex
- [ ] Pitch panel: demo PIN, QR code, one-tap role sign-in, reset, Demo inbox for emails
- [ ] "Fill test card" in checkout; nightly demo reset
- [ ] `packages/create-tbj-restaurant`: `login` (keychain), `new` questionnaire, Google Places import,
      website + menu AI import, manual intake, review step, Vercel deploy, QR output
- [ ] Photo import from Google, Yelp (if key) and website; AI tagging, hero/item/gallery picks, attribution, contact-sheet review
- [ ] `list`, `reset`, `delete`; Yelp API import if a key is set
- [ ] Build The Hood demo with it end to end

**Demo:** run `new` for a restaurant you've never seen, have its site on your phone in under 5
minutes, and run the three-screen pitch (phone order → tablet kitchen → laptop dashboard).

Pitching can start here. Later phases add features to every open demo automatically.

## Phase 4 — Email (2–3 days)
- [ ] Resend + React Email, outbox worker with retries
- [ ] Receipt, ready, refund, magic-link, invite templates

**Demo:** receipt arrives with modifiers rendered correctly.

## Phase 5 — PWA (2 days)
- [ ] Manifest + icons from config, Serwist service worker, offline menu
- [ ] Web Push for "order ready", install prompt after first order
- [ ] Favorites and reorder

**Demo:** install on phone, place order, get "ready" push.

## Phase 6 — Voice agent (5–7 days)
- [ ] `/api/voice/*` endpoints with signature verification and per-call carts
- [ ] Voice alias matching + ambiguity responses
- [ ] Stripe payment link via SMS; pay-at-pickup option
- [ ] Retell agent template + prompt; transfer to staff
- [ ] Transcript regression tests; Calls page in admin

**Demo:** call the number, order "large pepperoni, hold the sausage, add onions," and watch it
hit the kitchen screen.

## Phase 7 — Newsletter (3–4 days)
- [ ] Signup + double opt-in, unsubscribe, bounce/complaint webhooks
- [ ] Composer with menu-item and promo blocks, scheduling, batch sending
- [ ] Results page

## Phase 7b — Content: footer, legal, events, pages & forms (4–5 days)
- [ ] Footer component driven by config + `pages.footer_column`
- [ ] Legal page templates (privacy, terms) filled from config; "needs legal review" flag
- [ ] Events: admin add/edit with recurrence, home/events pages, Event JSON-LD
- [ ] Page builder: form/landing/blank templates, field editor incl. file upload
- [ ] Starter pages: Play at The Hood, Private Events, Catering, Jobs
- [ ] Requests inbox (bands, private events, catering, jobs) with per-type status steps, notify + auto-reply emails, honeypot + Turnstile
- [ ] Admin bottom tab bar + More screen

**Demo:** owner adds a weekly bingo night from their phone; a band applies through the form
and the owner gets an email and an unread badge.

## Phase 7c — Staff scheduling & time clock (7–9 days)
- [ ] Employees, invites (code + password), staff role routing to the staff portal
- [ ] Availability, preferred shifts, max hours, time-off requests + approvals
- [ ] Schedule builder grid, shift form, `domain/scheduling.ts` warnings (unit tested), copy week, publish
- [ ] Time clock with geofence, breaks, early clock-in rule, kiosk + PIN mode
- [ ] Timesheets: flags, manager edits with audit trail, approve, payroll CSV export
- [ ] Notifications: published, reminders, time-off decisions, forgotten clock-out
- [ ] Shift cover: ask, pick up, manager approve/deny, swaps as linked requests
- [ ] Labor rules config (California defaults)

**Demo:** owner invites a bartender, the bartender sets availability, the owner builds and
publishes the week, the bartender gets a text, clocks in at the bar, and the hours show on
the timesheet.

## Phase 7d — Optional: payroll & deposits (4–5 days)
- [ ] Gusto connection (OAuth), employee matching, send approved hours ([14](14-payroll-deposits.md))
- [ ] Deposit links from the Requests inbox (Stripe payment links, card + ACH), webhook → *Deposit paid*

**Demo:** owner approves the week and the hours appear in Gusto; a catering customer pays a
$200 deposit by bank transfer and the request moves to Deposit paid.

## Phase 8 — Clone tooling (3–4 days)
- [ ] `create-tbj-restaurant promote`: client repo from demo data, Neon, Vercel, Stripe, Resend, Retell, redirect demo
- [ ] AI menu import review screen in admin
- [ ] Promote a demo to live end to end; fix whatever hurt

## Phase 9 — Chain mode (3–4 days)
- [ ] Locations admin, location picker, `/l/[location]` routes
- [ ] Per-location payments accounts, Retell numbers, manager scoping
- [ ] Cross-location reports

## Final step (per client, after they sign) — Social sign-in
- [ ] Google OAuth app per client domain; turn on "Continue with Google"
- [ ] Facebook (Meta) app per client domain, Meta review; turn on "Continue with Facebook"
- [ ] `promote` disables the shared-password test accounts

## Later backlog
Delivery, loyalty, gift cards, table QR ordering, SMS notifications, receipt printers,
catering requests, reviews prompt, multi-language menu.

## Definition of done (every phase)
- Unit + e2e tests pass in CI; Lighthouse mobile ≥ 90 on public pages
- Works at 375px; keyboard and screen-reader basics pass
- Docs in `/docs` updated for anything that changed
