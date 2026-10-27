# 07 — PWA & Mobile-First

## Mobile-first rules

- Design at 375px first; enhance at `md` (768) and `lg` (1024).
- Thumb zone: primary actions (Add to order, Checkout) in a sticky bottom bar.
- **Bottom tab bar** (app-style) on browsing screens: Home · Menu · **Order** (raised center
  button, cart count badge) · Events · Account. Hidden during checkout and order tracking so
  the single primary action stays clear. Respects the iOS home-indicator safe area
  (`env(safe-area-inset-bottom)`). Events tab only when `features.events` is on; on desktop
  (`lg`) it becomes a top nav.
- Item customization opens as a **bottom sheet**, not a new page.
- Tap targets ≥ 44px; no hover-only interactions.
- Images: `next/image`, AVIF/WebP, blurred placeholders; menu list virtualized only if > 150 items.
- Performance budget: < 170KB JS on the menu route; menu page is a server component with
  cached data (revalidated on menu edit via `revalidateTag('menu')`).

## Desktop layout (`lg` ≥ 1024px)

Same pages and components, wider rules — not a separate site:

| Area | Mobile | Desktop |
|---|---|---|
| Navigation | Bottom tab bar (on browsing screens only) | Top nav: logo left, links, **Order** pill with cart count on the right; shown on every customer page incl. checkout |
| Content width | Full width, 16px gutters | Centered column: 1080px for home/menu/events, 680px for cart/checkout/status/account |
| Home | Hero, swipeable specials row, event list | Full-bleed hero (larger type), specials as a 4-column grid with hover lift, events in 2–3 columns; sticky "Order now" bar dropped (nav has Order) |
| Menu | Single-column list | Responsive card grid (`auto-fill, minmax(320px, 1fr)`) |
| Item customize | Bottom sheet | Centered modal (560px) |
| Primary action bar | Full-width sticky button | Right-aligned 380px button |

The mock UI has a **Mobile / Desktop** toggle at the top to preview both.

## Installable

- `app/manifest.ts` generated from config: name, short_name, theme/background colors,
  icons (192, 512, maskable) generated from `/brand/logo.svg` by the setup script.
- Custom "Add to Home Screen" prompt after a completed order (not on first visit);
  iOS gets an instructional sheet since it has no install prompt API.

## Service worker (Serwist)

| Resource | Strategy |
|---|---|
| App shell, fonts, icons | Precache |
| Menu data + images | Stale-while-revalidate |
| Cart / checkout / admin API | Network only |
| Order status page | Network first, cached fallback |

Offline: menu browsable with an "You're offline — ordering resumes when you reconnect" banner.

## Push notifications

- Web Push (VAPID keys generated per deploy).
- Asked **after** checkout: "Want a notification when your order is ready?" (iOS requires the
  app be installed to the home screen — fall back to email/SMS).
- Sent from `outbox` on status → `ready`. Owner can also send promo pushes (opt-in separate
  from order notifications).

## Other niceties

- Saved favorites and one-tap reorder.
- Share an item (Web Share API).
- Schema.org `Restaurant`, `Menu`, `MenuItem`, `OpeningHoursSpecification` JSON-LD for Google.
- Deep links: `/menu/[item]` opens the item sheet directly (used in newsletters).
