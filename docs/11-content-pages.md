# 11 — Footer, Legal, Events & Content Pages

Everything an owner needs to run the non-ordering side of the site without a developer.

## Footer

One component on every customer page (hidden in admin). Built from config + DB, so new
pages show up automatically.

| Column | Contents |
|---|---|
| Brand | Logo/name, tagline |
| Visit | Address, hours (from `location_hours`), phone. Chains: link to locations page |
| Explore | Menu & order, Events, plus any page with `footer_column = 'explore'` (e.g. Jobs) |
| Host with us | Pages with `footer_column = 'host'` (Book a band, Private events) |
| Follow | Social links from `restaurant.config.ts` |
| Legal row | © year + name, **Privacy Policy**, **Terms of Service**, Accessibility |

Mobile: 2-column grid above the bottom tab bar. Desktop: full-width dark band, 4 columns.

## Legal pages

- `/privacy` and `/terms` are **system pages** (`pages.kind = 'legal'`) generated at setup from
  templates in `/content/legal/*.md`, filled with values from config: business name, address,
  contact email, which services are on (voice, newsletter, jobs, events).
- The privacy template covers: data collected, Stripe handling payments, **phone calls may be
  recorded** (voice feature), email opt-in/unsubscribe, cookies/analytics, service providers,
  California privacy rights (CCPA/CPRA), contact.
- The terms template covers: ordering and price changes, payment and tips, pickup hold time,
  alcohol (21+, not sold online), events and private bookings, promo codes, liability, California law.
- Each page shows "Last updated" and is editable in admin. The setup script flags them
  **"needs legal review"** until the owner marks them reviewed. These are templates, not legal advice.
- An Accessibility statement page is optional (same mechanism).

## Events manager (admin → Events)

Goal: an owner adds bingo night from their phone in under a minute.

- **+ Add event** form: name, date, start time, repeats (none / weekly / monthly), type
  (live music, bingo, karaoke, sports, other), short description, flyer/photo upload,
  **button links to** (none, one of our form pages, or an external ticket URL),
  "Show on home page", "Add to next newsletter".
- List shows upcoming events with a home-page toggle and delete. Weekly events generate their
  occurrences automatically; a single occurrence can be cancelled ("No bingo Thanksgiving").
- Public: `/events` (full list, filter chips), next 3 featured on the home page, schema.org
  `Event` JSON-LD for Google.

## Page & form builder (admin → More → Pages & forms)

One-off pages without code. Templates:

| Template | Example use |
|---|---|
| **Form page** | Book a band, Private events & rentals, Job applications, Catering |
| **Event landing** | Halloween Bash page with flyer, details, RSVP form |
| **Blank** | Anything else (About, FAQ) |

Page = title, URL slug, status (draft/published), intro content (text, images, package cards),
optional form, footer placement, and **notify email**.

### Form fields
Short text, long text, email, phone, date, number, dropdown, checkbox, **file upload**
(resumes, band press kits — PDF/DOC/image, 10MB limit, stored in Vercel Blob, private URL).
Each field: label, required, help text, options (dropdown). Drag to reorder.

### Shipped as starter pages (per client, editable)
1. **Play at The Hood** (`/play`) — band name, contact, email, phone, genre, links, preferred dates, about.
2. **Private Events & Rentals** (`/private-events`) — name, email, phone, event type, date,
   guest count, space, food & drinks, notes.
3. **Work at The Hood** (`/jobs`) — name, email, phone, position, availability, 21+ check,
   resume upload, why us. Job-applicant data is personal data: kept private to owner/manager
   roles, auto-deleted after 12 months (configurable).
4. **Catering** (`/catering`) — name, company, email, phone, date needed, headcount, pickup or
   drop-off, notes.

### Requests inbox (admin → More → Requests)
- One inbox for every form page, with an unread count on the admin **More** tab and a
  "N new requests" card on the admin Home dashboard.
- Filter chips: All · Bands · Private events · Catering · Jobs (and any custom form).
- Status steps depend on the form type (`pages.request_type`):
  - Bands: New → Contacted → Booked / Declined. **Add to events** pre-fills an event.
  - Private events and catering: New → Quoted → Deposit paid → Booked / Declined.
    **Send deposit link** emails a Stripe payment link, payable by bank transfer or card
    (optional feature, [14](14-payroll-deposits.md)); paying it moves the request to *Deposit paid*.
  - Jobs: New → Interview → Hired / Declined. Hired can send a staff invite.
- **Reply** opens an email to the submitter from the restaurant's address.
- On submit: email to the page's notify address, auto-reply confirmation to the submitter
  (React Email template), optional push to owner.
- Spam protection: hidden honeypot field, rate limit per IP, and Cloudflare Turnstile
  (an invisible bot check) on public forms.
- Export CSV.

## Data

See [02-data-model](02-data-model.md): `pages`, `form_submissions`, `events`.
