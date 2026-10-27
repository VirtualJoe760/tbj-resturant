# 08 — Cloning Playbook

How to launch a new restaurant from the template. Target: < 1 hour of operator time.

Every client starts as a free **demo** built by `create-tbj-restaurant new` and goes live with
`create-tbj-restaurant promote`. The questionnaire, demo mode and pitch flow are in
[15-intake-and-demo](15-intake-and-demo.md). The steps below are what `promote` runs.

## What's per-client vs shared

| Per client (edit freely) | Shared template (don't edit in client repos) |
|---|---|
| `restaurant.config.ts` | `/app`, `/src`, `/scripts` |
| `/brand` (logo, theme.css, icons) | DB schema & migrations |
| `/content` (about, photos, legal text) | Email templates (themed via config) |
| `seed/menu.json` (initial menu) | Voice agent template |
| Vercel env vars | |

Keeping this boundary is what makes `git pull upstream main` painless.

## Steps

```bash
npx create-tbj-restaurant promote tonys-pizza
```

The CLI (`packages/create-tbj-restaurant`) walks through:

1. **Repo** — creates `tonys-pizza` from the template on GitHub, adds `upstream` remote.
2. **Config** — written from the demo data (name, timezone, address, phone, colors) into `restaurant.config.ts`.
3. **Brand** — logo from the demo, generates PWA icons and favicon.
4. **Database** — creates a Neon project via Neon API, runs migrations, seeds brand +
   first location + menu copied from the demo (including edits made during the pitch).
5. **Vercel** — creates the project, links the repo, sets env vars (secure prompt for any
   secret), connects the custom domain.
6. **Payments** — Connect: creates the connected account and prints the onboarding link for
   the owner. Direct: secure prompt for the restaurant's keys, registers the webhook endpoint.
7. **Email** — adds the sending domain in Resend, prints DNS records.
8. **Voice** (optional) — creates the Retell agent from template, buys/attaches a number.
9. **Owner account** — creates the owner user and emails a login link.
10. **Smoke test** — places a Stripe test-mode order end to end, then switches to live.

Every step is idempotent and resumable (`--from=payments`).

## Menu import

```bash
npm run import-menu -- ./menu.pdf
```

Sends the PDF/photo to Claude with a strict JSON schema (categories, items, modifier groups),
writes `seed/menu.json`, and opens a review screen in admin before anything goes live.
CSV import also supported (template in `/seed/menu-template.csv`).

## Environment variables

| Var | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled connection |
| `BETTER_AUTH_SECRET` | generated |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | platform keys (connect) or restaurant keys (direct) |
| `STRIPE_CONNECT_ACCOUNT_ID` | connect mode only |
| `RESEND_API_KEY`, `EMAIL_FROM` | |
| `RETELL_API_KEY`, `RETELL_WEBHOOK_SECRET` | if voice enabled |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | generated |
| `SENTRY_DSN` | optional |
| `APP_MODE` | `demo` or `live` |
| `DEMO_SLUG`, `DEMO_PIN` | demo only: which demo schema to use, pitch panel PIN |

## Growing into a chain

No new deploy, no schema change:

1. Admin → Settings → Locations → **Add location** (address, hours, phone, capacity).
2. Optional per-location price/availability overrides in the menu editor.
3. Optional separate Stripe account for the location (franchise) via `payment_account_id`.
4. Optional per-location Retell number.
5. The site automatically shows a location picker (remembered per device) once > 1 active
   location exists; URLs become `/l/[location]/menu`.
6. Assign managers to specific locations via memberships.

## Pulling template updates

```bash
git fetch upstream
git merge upstream/main
npm run db:migrate
```

CI runs the shared contract tests (pricing, cart validation, webhooks, voice transcripts)
against the client's seed menu before deploy.
