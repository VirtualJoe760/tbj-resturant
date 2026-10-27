# 01 — Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)**, TypeScript | Server components, route handlers, server actions, Vercel-native |
| Hosting | **Vercel** | One project per restaurant; preview deploys |
| Database | **Neon Postgres** + **Drizzle ORM** | Serverless Postgres, branching for previews, typed schema + migrations |
| UI | **Tailwind CSS** + **shadcn/ui** | Fast, themeable via CSS variables per restaurant |
| Payments | **Stripe** (Connect or direct keys) | Checkout, Apple/Google Pay, webhooks, Stripe Tax |
| Auth | **Better Auth** (email + password now; Google and Facebook at launch) | Self-hosted in our DB, roles, no per-seat cost |
| Email | **Resend** + **React Email** | Receipts and newsletters from the same templates |
| Voice | **Retell AI** | Phone agent calling our HTTP functions |
| Files | **Vercel Blob** | Menu photos, logos |
| Realtime | Server-Sent Events from a route handler (polling fallback) | Kitchen screen updates without extra infra |
| Jobs / cron | Vercel Cron + an `outbox` table | Newsletter batches, retries, reminders |
| Validation | **Zod** | Shared schemas for web, voice, and admin APIs |
| Monitoring | Sentry + Vercel Analytics | Errors and performance per deploy |

## Deploy model: one deploy per brand

```
                ┌──────────────── GitHub: restaurant-template (upstream) ───────────────┐
                │                                                                        │
     fork/clone ▼                              fork/clone ▼                              ▼
 tonys-pizza repo                        harbor-tacos repo                    ...more clients
   │  restaurant.config.ts                  │  restaurant.config.ts
   │  /brand (logo, colors)                 │  /brand
   ▼                                        ▼
 Vercel project ── Neon DB              Vercel project ── Neon DB
 Stripe: Connect acct or own keys       Stripe: Connect acct or own keys
 Retell agent + phone number            Retell agent + phone number
```

- Client repos pull template updates from `upstream` (git remote). Client-specific code lives
  only in `restaurant.config.ts`, `/brand`, and `/content` so merges stay clean.
- **Chain model:** the same deploy serves many locations. Every location-sensitive row
  (orders, hours, stock, prices) already carries `location_id` from day one, so a single
  shop is just a chain with one location.

## Repo layout

```
/app
  /(site)            public pages: home, menu, item, cart, checkout, order status, account
  /(admin)/admin     dashboard, orders, kitchen, menu editor, hours, promos, newsletter, settings
  /api
    /stripe/webhook  payment events
    /voice/*         Retell function endpoints
    /orders/stream   SSE feed for kitchen screen
    /cron/*          scheduled jobs
/src
  /config            loads + validates restaurant.config.ts
  /db                drizzle schema, migrations, seed
  /domain            pure business logic — NO framework imports
    menu.ts          menu resolution (brand menu + location overrides)
    pricing.ts       priceLine(), priceCart() — the ONLY place prices are computed
    cart.ts          validate selections against modifier rules
    hours.ts         open/closed, pickup slot generation, throttling
    orders.ts        create/transition orders (state machine)
  /payments          PaymentProvider interface + connect.ts + direct.ts
  /email             React Email templates + send helpers
  /voice             Retell function handlers, menu-to-speech helpers
  /auth              Better Auth setup, role guards
/brand               logo, icons, theme.css (per client)
/content             about text, photos (per client)
/docs
/packages/create-restaurant   intake questionnaire, demo deploy, promote to live (private npm)
/scripts             import-menu, seed
```

**Rule:** web, voice, and admin all go through `/src/domain`. Nothing computes a price or
validates a modifier anywhere else.

## Config

```ts
// restaurant.config.ts
export default defineRestaurant({
  slug: "tonys-pizza",
  name: "Tony's Pizza",
  timezone: "America/New_York",
  currency: "usd",
  theme: { primary: "#C8102E", font: "Inter", radius: "lg" },
  payments: { mode: "connect" },          // or "direct"
  features: { voice: true, newsletter: true, tips: true, scheduledOrders: true, delivery: false },
  tax: { mode: "stripe_tax" },            // or { mode: "flat", rate: 0.0875 }
  locations: "db",                        // locations live in DB; seed creates the first
});
```

Secrets stay in Vercel environment variables, never in config. See [08-cloning-playbook](08-cloning-playbook.md).

In demo mode (`APP_MODE=demo`) the same settings are read from the demo database instead of
this file, so demos deploy straight from the template repo ([15](15-intake-and-demo.md)).

## Environments

| Env | Database | Stripe |
|---|---|---|
| Demo (pitch) | Shared demo Neon project, one schema per prospect | Test mode, our platform account |
| Local | Neon dev branch | Test mode |
| Preview (per PR) | Neon branch auto-created per preview | Test mode |
| Production | Neon main branch | Live mode |

## Security basics

- Admin routes guarded by role middleware; all mutations re-check role server-side.
- Retell endpoints verify Retell's request signature.
- Stripe webhook verifies signature; orders are only marked paid from the webhook, never from the client redirect.
- Rate limits on checkout, voice functions, newsletter signup.
- No card data touches our servers (Stripe-hosted fields only).
