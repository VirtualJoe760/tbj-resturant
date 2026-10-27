# 00 — Overview

## Goal

A restaurant web app template that can be cloned for a new client in under an hour, and that
grows from a single small shop to a multi-location chain without a rewrite.

## Who uses it

| User | Needs |
|---|---|
| **Customer** (phone, mostly) | Browse menu, customize items, pay, get a receipt, know when it's ready, reorder |
| **Caller** | Order by phone in plain speech: "large pepperoni, hold the sausage, add onions" |
| **Staff** | See incoming orders, mark them in-progress/ready, mark items sold out |
| **Owner** | Edit menu, hours, prices, promos; see sales; send newsletters; manage staff |
| **Chain manager** (later) | Same as owner, across locations, with per-location overrides |
| **You (operator)** | Clone, configure, deploy, and maintain many restaurants from one codebase |

## In scope (v1)

- Menu with items, categories, photos, and **modifier groups** (add / remove / extra / light / half)
- Pickup ordering (delivery as a later phase), scheduled pickup times with kitchen throttling
- Stripe payments — Connect (platform) or the restaurant's own keys
- Email receipts and order-status emails
- Owner/staff login, dashboard, live kitchen screen, "86" (sold-out) toggles
- Retell voice agent that builds real orders through the same API as the website
- Newsletter: sign-up, double opt-in, compose and send, unsubscribe
- PWA: installable, offline menu, "order ready" push notification

## Home page

Goal: get people to **Order now** in one tap, and show what's new.

1. **Hero** — brand, one-line tagline, live open/closed status with closing time and pickup
   wait, big **Order now** button → `/menu`.
2. **Specials & new** — horizontal carousel from `featured_items` (badge + blurb + price).
   Tapping one opens the menu with that item's customize sheet already open (`/menu/[item]`).
   Sold-out specials show a "Sold out" badge. Scheduled specials appear/disappear on their own
   (`starts_at` / `ends_at`), e.g. happy hour only from 2–6 PM.
3. **Upcoming events** — next 4 from `events` (only when `features.events` is on), link to `/events`.
4. **Visit us** — address, hours, directions and call buttons.
5. **Newsletter signup** — email field, double opt-in.
6. **Sticky bottom bar** — "Order now" stays on screen while scrolling.

When the store is closed, the CTA becomes "Order ahead for 2:15 PM".
Owners manage specials and events in admin (**Home** and **Events** screens).

## Later

Delivery (in-house radius or DoorDash Drive), loyalty points, gift cards, table QR ordering,
catering requests, receipt printers, SMS notifications, AI menu import, multi-location UI.

## Non-goals

- Running a marketplace across restaurants (each deploy is one brand)
- Point-of-sale hardware replacement
- Table reservations (link out to an existing service if needed)

## Success measures

- New restaurant live in **< 1 hour** of operator time (menu import aside)
- Lighthouse mobile score ≥ 90, menu interactive in < 2s on 4G
- Voice agent completes a typical modified order without a human > 90% of the time
- Zero price mismatch between voice, web, and receipts (single pricing function)
