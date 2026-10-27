# 17 · Delivery and order alerts

## Delivery without the 30% cut

The customer orders on the restaurant's own site and picks **Delivery**. We hire a driver from
**DoorDash Drive** or **Uber Direct**: their delivery-only services, which send a DoorDash or Uber
driver for a flat fee per trip. The restaurant keeps its prices, its customers and its margin; it
is not listed in the DoorDash / Uber Eats apps through this.

```
checkout ── address ──▶ quote (fee + ETA) ──▶ customer pays (food + tax + delivery fee + driver tip)
   paid ──▶ book the driver (accept the quote) ──▶ kitchen: Start → Ready
   driver: assigned → at the restaurant → picked up → arriving → delivered
```

| Piece | Where |
|---|---|
| Settings | `restaurant.delivery` in `src/config/restaurant.ts`: `enabled`, `provider` (`"doordash"` / `"uber"`), `customerFee` (`"quote"` = pass the driver fee through, or a flat amount in cents and the restaurant covers the rest), `minOrderCents`. The CLI writes these |
| Services | `src/delivery/`: `doordash.ts` (JWT auth, quotes → accept, delivery status), `uber.ts` (OAuth, quotes → deliveries), `demo.ts` (pretend driver) behind one `DeliveryProvider` interface, like payments |
| Flow | `src/server/delivery-service.ts`: `quoteDelivery` (stores the quote server-side; the browser only gets a reference), `bookDelivery` (runs when the order is paid), `refreshDelivery` (asks the service for status at most every 10 s while someone is watching: order page, kitchen screen, dashboard) |
| Checkout | Pickup / Delivery switch, address, live price and ETA, minimum order, tip goes to the driver |
| Kitchen | Delivery tickets show 🚗 and the driver's status; the ticket leaves the board when the driver picks it up (or "Handed to driver") |
| Admin | Dashboard switch to pause delivery (pickup stays open) |

**Turning it on for a client:** they open a DoorDash Drive (or Uber Direct) business account in
their own name, and we add its keys as Vercel environment variables (`DOORDASH_DEVELOPER_ID`,
`DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET`, or `UBER_CUSTOMER_ID`, `UBER_CLIENT_ID`,
`UBER_CLIENT_SECRET`). Both have free test ("sandbox") keys. Without keys, demo sites use the
**demo driver**: a believable fee, and a trip that follows the kitchen (picked up 30 s after
Ready, delivered ~3 min later), so a pitch shows the whole thing.

Status comes from polling, so there are no webhooks to register. DoorDash and Uber webhooks can be
added later for instant updates when nobody has a page open.

**Not built yet:** delivery radius check before quoting (the services refuse out-of-range
addresses themselves), scheduled delivery for later, refunds of the delivery fee, and showing
marketplace orders (Uber Eats / DoorDash app orders) on our kitchen screen. That last one goes
through a middleman such as Deliverect, Otter or Chowly, per client.

## Order alerts

When the kitchen taps **Start** and **Ready**, and when a delivery driver picks up or drops off,
the customer is told three ways:

1. **Dashboard** (Account tab): *Happening now* cards with a progress bar, an *Updates* list with
   unread dots, and a badge on the Account tab.
2. **Pop-up banner** on whatever page of the site they're on. Works for guests too: the phone
   remembers the orders it placed (`src/components/alerts-store.ts`).
3. **Phone notification** (Web Push), after they tap *Notify me* on the order page or dashboard.
   Works on Android and desktop browsers; on iPhone only once the site is added to the home screen
   (iOS 16.4+), which the button explains. Push keys are generated once and kept in the database
   (or set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`).

Code: messages in `src/domain/order-alerts.ts`; `notifyOrder()` in `src/server/notify.ts` writes
the `notifications` row and sends the pushes; `transitionOrder` and `refreshDelivery` call it.
Pickup orders still get the "ready" email.

**Not built yet:** text messages (SMS) for customers who don't install the app.
