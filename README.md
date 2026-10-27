# Restaurant template

Clone-per-restaurant ordering site: menu with real modifiers, checkout, kitchen screen, owner
admin, staff scheduling and time clock, events, form pages, newsletter, phone-ordering API and
an intake CLI that builds a demo for a new restaurant. First client: The Hood Bar & Pizza.

Design docs live in [docs/](docs/README.md).

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. With no `DATABASE_URL` the app uses an embedded Postgres in `./.data`
and seeds The Hood's menu, events, team and sample orders on first start. With no Stripe key,
checkout runs in demo mode (tap **Fill test card**). Every email lands in the **Demo inbox**
(`/demo/inbox`) instead of being sent.

To try it on a phone or tablet on the same Wi-Fi, open the "Network" address `pnpm dev` prints
(e.g. `http://192.168.x.x:3000`).

## Test accounts

Every demo site has one account per account type, listed on `/login` (tap one to fill it in).
The shared test password is in [src/db/test-accounts.ts](src/db/test-accounts.ts).

| Email | Lands on |
|---|---|
| `admin@thehoodpalmdesert.com` | Admin dashboard (owner) |
| `employee@thehoodpalmdesert.com` | Staff portal (Alex, bartender) |
| `kitchen@thehoodpalmdesert.com` | Kitchen screen + 86 board |
| `customer@thehoodpalmdesert.com` | Account with order history |

## New restaurant

```bash
pnpm create-restaurant login      # once: Google Places / Yelp / Anthropic keys (hidden prompts)
pnpm create-restaurant new        # questionnaire → clients/<slug>/
pnpm import-client <slug>         # load it into the database (stop pnpm dev first when using the local DB)
```

See [docs/15-intake-and-demo.md](docs/15-intake-and-demo.md).

## Scripts

| Script | Does |
|---|---|
| `pnpm test` | Domain logic, seed, voice parser and import tests |
| `pnpm typecheck` | TypeScript |
| `pnpm db:generate` | New migration from `src/db/schema.ts` (drizzle-kit) |

## Environment

Copy `.env.example` to `.env.local`. Everything is optional for local demos except
`BETTER_AUTH_SECRET`.
