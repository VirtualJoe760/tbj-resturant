# 03 — Ordering & Payments

## Customer flow

```
Menu ─► Item sheet (choose modifiers) ─► Cart ─► Checkout (name, phone, email, pickup time, tip)
     ─► Stripe payment ─► Order status page (live) ─► "Ready" push/email ─► Receipt email
```

- Guest checkout by default; optional account for reorder and saved favorites.
- Cart lives in a cookie-backed server cart (`carts` row) so it survives refreshes and the
  PWA reopening, and so the server always re-prices.
- If the store is closed, the menu is browsable and checkout offers the next available
  pickup slot ("Order ahead for 11:30 AM tomorrow").

## Validation and pricing (shared core)

```ts
// src/domain/cart.ts
validateLine(item, selections, location): Result<ValidLine, LineError[]>
// checks: item available at location, required groups satisfied, min/max per group,
// modifier belongs to item, modifier available, placement allowed, quantity level allowed

// src/domain/pricing.ts
priceLine(validLine, location): { unitCents, lineCents, breakdown[] }
priceCart(lines, { location, promo, tipCents, fulfillment }): {
  subtotalCents, discountCents, taxCents, feeCents, tipCents, totalCents
}
```

Web, voice, admin manual orders, and receipt rendering all call these. Client-side price
display uses the same module (it's pure TypeScript), but the server total is authoritative.

## Pickup slots and throttling

- Slots every `slot_minutes` (default 15) inside open hours, starting `now + pickup_lead_minutes`.
- A slot is full when `orders in slot >= max_orders_per_slot` (optionally weighted by item count).
- Owner can hit **"Busy mode"** to add +15/+30 min to lead time, or **pause online ordering**.

## PaymentProvider interface

```ts
interface PaymentProvider {
  createCheckout(order: Order, opts: { successUrl; cancelUrl }): Promise<{ clientSecret?; url? }>;
  createPaymentLink(order: Order): Promise<{ url }>;     // for voice orders via SMS
  refund(order: Order, amountCents?: number): Promise<void>;
  verifyWebhook(req: Request): Promise<StripeEvent>;
  onboardingLink?(): Promise<{ url }>;                     // connect only
  status(): Promise<{ chargesEnabled; payoutsEnabled }>;
}
```

### Mode A — Stripe Connect (default)

- We operate one Stripe **platform** account. Each restaurant has a **connected account**
  (Express for easiest onboarding; Standard if they want full Stripe dashboard control).
- Onboarding: Admin → Settings → Payments → "Connect with Stripe" → Stripe-hosted onboarding
  → returns to admin; `account.updated` webhook flips `charges_enabled`.
- Charges: **direct charges on the connected account** (restaurant is merchant of record,
  their name on statements, they handle disputes) with optional `application_fee_amount`
  = `platform_fee_bps` of the total.
- Chain: one connected account per brand by default; a location may point to its own
  `payment_account_id` (franchise model).
- Webhook: a single Connect webhook endpoint receives events for all connected accounts;
  we route by `event.account`.

### Mode B — Bring your own key (direct)

- Restaurant's own `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set as Vercel env vars
  (entered via the setup script's secure prompt, never in the repo).
- Same checkout code path, minus `stripeAccount` header and application fee.
- No platform fee possible in this mode (bill the client separately).

### Common to both

- **Stripe Payment Element** embedded in checkout (Apple Pay / Google Pay / cards / Link).
- **Tax:** Stripe Tax or a flat configured rate per location.
- **Tips:** preset % buttons + custom; tip is a separate line in the total.
- Order is marked `paid` **only** from `payment_intent.succeeded` webhook. Idempotent by event id.
- Refunds from admin (full or partial) call `provider.refund`, then `charge.refunded`
  webhook updates status and sends a refund email.

### Deposits for events and catering (optional)

Private events and catering requests can collect a deposit through a Stripe payment link sent
from the Requests inbox. Customers pay by card or by **bank transfer (ACH Direct Debit)**,
which costs 0.8% capped at $5 instead of about 3% on a card, but takes ~4 business days to
clear. Details in [14-payroll-deposits](14-payroll-deposits.md). Not offered for regular
pickup orders, because the money wouldn't clear before the food is ready.

## Webhook events handled

| Event | Action |
|---|---|
| `payment_intent.succeeded` | order → `paid`; enqueue receipt email, notify kitchen |
| `payment_intent.payment_failed` | order stays `pending_payment`; show error |
| `checkout.session.expired` / PI canceled | order → `expired` |
| `charge.refunded` | order → `refunded` / `partially_refunded`; refund email |
| `charge.dispute.created` | flag order, email owner |
| `account.updated` (Connect) | update `payment_accounts` status |

## Promo codes

Percent, fixed amount, or free item; min subtotal; date window; usage limits; per-location.
Applied in `priceCart` before tax.
