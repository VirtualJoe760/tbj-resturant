# Restaurant Template — Documentation

A clone-per-restaurant ordering platform: mobile-first PWA, online ordering with Stripe,
voice ordering with Retell, an owner dashboard, email receipts, and a newsletter.

| Doc | What it covers |
|---|---|
| [00-overview](00-overview.md) | Product goals, users, scope, non-goals |
| [01-architecture](01-architecture.md) | Stack, deploy model, repo layout, tenancy |
| [02-data-model](02-data-model.md) | Database schema (menu, modifiers, orders, locations) |
| [03-ordering-payments](03-ordering-payments.md) | Cart, pricing, checkout, Stripe Connect + bring-your-own-key |
| [04-voice-agent](04-voice-agent.md) | Retell phone agent, functions, conversation rules |
| [05-admin](05-admin.md) | Owner/staff dashboard, kitchen screen, roles |
| [06-email-newsletter](06-email-newsletter.md) | Receipts, transactional mail, newsletter |
| [07-pwa](07-pwa.md) | Installability, offline, push notifications |
| [08-cloning-playbook](08-cloning-playbook.md) | How to spin up a new restaurant (and a chain) |
| [09-build-plan](09-build-plan.md) | Phased build plan with milestones |
| [10-decisions](10-decisions.md) | Architecture decision log |
| [11-content-pages](11-content-pages.md) | Footer, privacy/terms, events manager, page & form builder (bands, rentals, jobs) |
| [12-staff-scheduling](12-staff-scheduling.md) | Staff accounts, schedule builder, availability, time off, clock in/out, timesheets |
| [13-accounts-roles](13-accounts-roles.md) | Webmaster, owner, manager, kitchen tablet, employee and customer accounts; who can do what |
| [14-payroll-deposits](14-payroll-deposits.md) | Optional: Gusto payroll (direct deposit for staff) and bank-transfer deposits for events and catering |
| [15-intake-and-demo](15-intake-and-demo.md) | `create-tbj-resturant` CLI (`npx create-tbj-resturant`): questionnaire (Google, Yelp, website or manual intake), free demo sites for pitching, promote to live |
| [17-delivery-and-order-alerts](17-delivery-and-order-alerts.md) | Delivery through DoorDash Drive / Uber Direct (demo driver for pitches), order alerts on the dashboard, pop-ups and phone notifications |
| [16-app-stores](16-app-stores.md) | `business-theme.ts` (logo, app icon, banners, fonts, colors), Admin → Branding, menu item photos, menu times, Play Store and App Store |
| [clients/the-hood](clients/the-hood.md) | Client #1 profile, draft menu, open questions |
| [mock-ui/index.html](mock-ui/index.html) | Clickable mobile mock of customer + admin screens |

## Two decisions everything else follows

1. **One deploy per restaurant brand.** Each client gets their own Vercel project and Neon
   database. A *chain* is still one deploy — it just has many `locations`.
2. **Stripe Connect by default, bring-your-own-key as an option.** Code talks to a
   `PaymentProvider` interface; the mode is set in config.
