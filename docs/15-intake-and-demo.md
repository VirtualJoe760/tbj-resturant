# 15 — Intake CLI & Demo (Pitch) Mode

Goal: walk into a restaurant with a working site **built for them**, open it on their phone,
your laptop and a tablet, and place a real (test) order that pops up on the kitchen screen.
Every demo costs nothing until they buy. Target: a new demo live in **under 5 minutes**.

```
 npx @ourco/create-restaurant new          npx @ourco/create-restaurant promote the-hood
 ─────────────────────────────────          ───────────────────────────────────────────────
 questionnaire → import → demo deploy  ──►  pitch  ──►  sold  ──►  own DB, Stripe, domain, live
 the-hood-palm-desert.vercel.app (demo)                        thehoodpalmdesert.com (live)
```

## The CLI package

- Lives in the template repo as `packages/create-restaurant`, published as a **private**
  npm package (`@ourco/create-restaurant`, scoped to our npm org, or GitHub Packages) so
  only we can install it. Built with `@clack/prompts` (the friendly arrow-key prompts).
- Commands:

| Command | Does |
|---|---|
| `login` | One-time: stores our account keys (Vercel, Neon, Google Places, Anthropic, Stripe test key, optional Yelp) in the computer's keychain via hidden prompts. Never in a file or the repo |
| `new` | Questionnaire → import → deploys a demo. Prints the URL and a QR code in the terminal |
| `list` | All demos and live sites with status (demo / live), URL, last opened |
| `refresh <slug>` | Re-runs the import (e.g. they updated their menu) without losing edits |
| `reset <slug>` | Wipes demo orders and puts the sample data back |
| `promote <slug>` | Turns a sold demo into a live client (below) |
| `delete <slug>` | Removes a demo that didn't sell: Vercel project, demo data, logo files |

## The questionnaire (`new`)

```
◆ Restaurant name?                    The Hood Bar & Pizza
◆ City?                               Palm Desert, CA
◆ Does it have a Google Business listing?   ● Yes  ○ No
    → shows the top matches from Google; pick one (or paste a Google Maps link)
◆ Does it have a Yelp page?           ● Yes  ○ No
    → paste the Yelp link
◆ Does it have a website?             ● Yes (found on Google: thehood…com)  ○ No
◆ Where's the menu?                   ○ Found on website  ○ PDF / photos  ○ Paste text  ○ Sample menu for "pizza bar"
◆ Photos                              ✓ 10 from Google · 3 from Yelp · 6 from website
    → AI sorted: 1 hero, 5 matched to menu items, 7 gallery, 3 skipped (blurry / faces) ▸ swap any
◆ Demo features                       [x] Online ordering [x] Kitchen screen [x] Events [x] Staff scheduling [ ] Voice
◆ Review ▸ (table of everything found; edit any line) ▸ Deploy
```

What each source gives us:

| Source | Gives | How |
|---|---|---|
| **Google Business listing** (main source) | Name, address, map location, phone, hours, website, photos, category | Google Places API (official; has a free monthly allowance) |
| **Yelp** | Categories, price level, photos, sometimes hours; the link goes in the footer | Yelp's official API if we have a key (it's paid after a trial). **We don't scrape Yelp pages**: that breaks Yelp's terms and their bot checks block it. Without a key, Yelp is just a link |
| **Website** | Menu, logo, brand colors, about text, email, social links | Fetch the pages; Claude reads them and fills our menu JSON schema |
| **Menu PDF / photos / pasted text** | Menu with prices and modifiers | Same AI menu import as [08](08-cloning-playbook.md) |

### Photos

Pulled automatically from every source the questionnaire found, then sorted by AI.

| Source | What we get | How |
|---|---|---|
| **Google Business listing** | Up to 10 photos (owner and customer uploads), each with the photographer's name | Places API photo endpoint |
| **Yelp** | Up to 3 photos | Yelp's official API (only if we have a key; no scraping) |
| **Website** | Images on their pages (hero shots, food, logo) | Fetched with the website import |
| **Manual intake** | Photos we drop in (files, phone shots from a visit) | Local files |

**AI sorting.** Claude looks at each photo and tags it: food (and which menu item it shows,
e.g. "Jalapeño Popper Pizza"), drinks, interior, exterior, event/crowd, logo. It skips blurry,
dark or duplicate shots, and keeps photos with recognizable faces out of the hero spot. It
then fills these spots:

| Spot | Pick |
|---|---|
| Home hero | Best wide food or interior shot |
| Menu item photos | Photos matched to specific items (items without a match show no photo) |
| Gallery / About | Interior, exterior, crowd |
| Events | Stage, band or crowd shots as default event images |

The review step shows a contact sheet (and a local preview page) where we swap or drop any photo.

**Who owns the photos.** Most listing photos are uploaded by customers, who own them. Google and
Yelp let apps *show* them, with credit to the photographer, but not copy them into our own
storage. So the two modes handle them differently:

- **Demo:** Google and Yelp photos are shown straight from their APIs (through our image
  route) with a small "Photo: Maria G. via Google" credit. Website photos are stored in Vercel Blob.
- **Promote (going live):** the CLI lists every photo by source. Listing photos must be replaced
  with photos the restaurant owns. These can come from their Google Business Profile account (once they
  connect it, we can download photos *they* uploaded), their website, uploads in admin, or a
  quick photo shoot. Anything not replaced is dropped at launch, not kept.

Data: `photos (id, source google/yelp/website/upload/business_profile, provider_ref?, blob_url?,
author_attribution?, owned bool, role hero/item/gallery/event, item_id?, ai_tags text[],
quality_score, approved)`.

### All "no": manual intake
If there's no Google listing, no Yelp and no website, the CLI asks for the basics:

| Field | Required | Notes |
|---|---|---|
| Business name | ✓ | |
| Address | ✓ | Looked up for map location and timezone |
| Phone | ✓ | |
| Email | ✓ | Owner contact; not shown publicly in demo |
| Menu | ✓ | PDF, photo(s), a link, pasted text, or a sample menu for their cuisine to get started |
| Hours | | Default 11 AM–9 PM, flagged "confirm with owner" |
| Logo / colors | | No logo → a clean text logo; colors picked from the logo or a palette for the cuisine |

### Review step
Before deploying, the CLI shows everything it found with its source (Google, website, AI,
default) and marks guesses in yellow, e.g. "Whole pie prices: guessed from slice price". Fix
anything inline. The same list is saved as `intake.json` and becomes the "questions for the
owner" checklist (like [clients/the-hood](clients/the-hood.md)).

## Demo mode (`APP_MODE=demo`)

The same app and code as live. Only the outside services are swapped for free ones:

| Piece | Demo | Live |
|---|---|---|
| Hosting | `<slug>.vercel.app`, a project on our existing Vercel Pro account | Their own Vercel project + custom domain |
| Database | **One shared free Neon project for all demos**, each demo in its own Postgres schema (`demo_the_hood`) | Their own Neon project |
| Restaurant settings | Stored in the demo database (brand row, theme, menu) + logo in Vercel Blob | `restaurant.config.ts` + `/brand` in their own repo |
| Payments | Stripe **test mode** on our platform account. Use card 4242 4242 4242 4242; nothing is charged | Their Stripe (Connect or own key), live mode |
| Email | Captured in an on-site **Demo inbox** (receipts, newsletter, staff invites); nothing goes out | Resend, their sending domain |
| Voice | Off (optional later: one shared demo phone number) | Their Retell agent + number |
| Search engines | Blocked (`noindex`, robots disallow) | Indexed |

Because every demo deploys straight from the template repo (`DEMO_SLUG` env var picks the
schema), **template improvements reach every open demo automatically**.

### What the prospect sees
- A thin banner on every page: "Demo site built for The Hood · orders aren't real".
- Their name, logo, colors, real menu, hours and address, plus sample specials, events and
  a sample staff team so the dashboard and schedule aren't empty.
- Checkout has a **"Fill test card"** button so nobody has to type 4242….

### The pitch panel (for us)
A floating button, unlocked with a 4-digit demo PIN, that the prospect never needs to find:
- **QR code** to open the site on their phone (also printed by the CLI).
- **One-tap sign-in** as any of the four test accounts (admin@, employee@, kitchen@, customer@,
  see [13](13-accounts-roles.md)), so switching roles mid-pitch takes a second. The same accounts
  also work from the normal sign-in page on any device.
- **Reset demo** (clear orders), **Demo inbox**, and a link to the intake checklist.

### The three-screen pitch
1. Laptop: owner dashboard. Tablet: kitchen screen (paired with the demo PIN). Their phone: the site.
2. They order a pizza with "no sausage, add onions" and pay with the test card.
3. The ticket appears on the tablet within a second; they tap Start → Ready; their phone shows "Ready".
4. On the laptop: today's sales update; flip an item to 86'd and it greys out on their phone.

All three screens share the same demo database, so this works across devices with no setup.

### Limits and cleanup
- Demo data resets nightly (orders, sign-ups), keeping any menu edits made during the pitch.
- Demos not opened for 60 days are listed by `list --stale` for deletion.
- A demo is a sales tool for a business that hasn't agreed to anything yet: it's always
  marked as a demo, never indexed, never sends email or takes real money, and we take it
  down if the business asks.

## Promote: from sold to live (`promote <slug>`)

Runs the existing go-live steps from [08](08-cloning-playbook.md), starting from the demo:

1. Creates the client repo from the template and writes `restaurant.config.ts`, `/brand` and
   `seed/menu.json` **from the demo data**, so menu edits made during the pitch carry over.
2. Creates their Neon project, runs migrations, copies menu, hours, events and pages. Demo
   orders, sample staff and the demo inbox are dropped.
3. Creates their Vercel project, sets `APP_MODE=live`, connects their domain.
4. Payments: Stripe Connect onboarding link for the owner (or their own keys via secure prompt).
5. Email domain in Resend, optional Retell number, owner account + login email.
6. Test order in Stripe test mode, then switches to live. The `.vercel.app` demo now redirects
   to the live site and the demo schema is deleted.

## Costs while pitching

| Service | Cost for demos |
|---|---|
| Neon | Free plan: one project holds all demo schemas (menus are tiny) |
| Stripe | Test mode is free |
| Google Places API | Free monthly allowance covers dozens of lookups a day |
| Claude API (menu/website import) | Cents per demo |
| Vercel | Our existing **Vercel Pro** account (already paid). Every demo is a project on it; no extra cost per demo |
