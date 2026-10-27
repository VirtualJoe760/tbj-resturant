# 06 — Email: Receipts & Newsletter

Provider: **Resend**. Templates: **React Email** in `/src/email/templates`, themed from
`restaurant.config.ts`. All sends go through the `outbox` table so they retry and never block
a request.

## Sending domain

Each restaurant sends from its own domain (e.g. `orders@tonyspizza.com`,
`news@tonyspizza.com`). The setup script adds the domain in Resend and prints the DNS records
(SPF, DKIM, DMARC) to add. Fallback until DNS verifies: a subdomain we control.

## Transactional emails

| Email | Trigger |
|---|---|
| Order confirmation / receipt | `payment_intent.succeeded` (or voice pay-at-pickup submit) |
| Order ready | status → `ready` |
| Order cancelled / refunded | status change / `charge.refunded` |
| Magic-link login | auth |
| Staff invite | owner invites |
| Newsletter confirm (double opt-in) | signup |
| Owner alerts | dispute, payouts disabled, voice agent errors |

### Receipt contents

Brand header, order number, pickup time & location address (map link), each line with
modifiers (same grouping as kitchen), subtotal / discount / tax / tip / total, payment method
last 4, "Reorder" button (deep link), opt-in checkbox state, footer with address + phone.
Rendered from the order's **snapshot** fields, so menu edits never change past receipts.

## Newsletter

### Audience
- Signup points: footer form, checkout opt-in checkbox (unchecked by default), PWA prompt.
- **Double opt-in:** `pending` → confirm link → `active`.
- Every email has one-click unsubscribe (`List-Unsubscribe` + `List-Unsubscribe-Post` headers)
  and a footer link; unsubscribes and bounces/complaints (Resend webhooks) set status.
- Tags/segments: location, "ordered in last 30 days", "lapsed 60+ days", custom tags.

### Composer
- Block editor in admin: heading, text, image, button, **menu item card** (pulls photo/price
  from menu), **promo code block** (creates a code on send).
- Preview desktop/mobile, send test to self, schedule.
- Sending: cron job batches through Resend's batch API, writes `campaign_sends`, respects rate limits.
- Results: delivered, opens, clicks, attributed orders (promo code or UTM).

### Compliance
- CAN-SPAM: physical address in footer, honest subject, unsubscribe honored immediately.
- Marketing opt-in is never inferred from placing an order.
