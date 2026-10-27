# 14 — Payroll & Deposits (optional features)

Both are off by default and turned on per client in `restaurant.config.ts`:

```ts
features: { payroll: "gusto" | false, deposits: true | false }
```

## Where money moves

| Money | Moves through | Lands |
|---|---|---|
| Customer pays for an order | Stripe (card, Apple/Google Pay) | Restaurant's bank, by automatic Stripe payout (daily, ~2 business days; Instant Payouts ~1.5% fee) |
| Customer pays an event/catering deposit | Stripe payment link (card or bank transfer) | Same as above |
| Restaurant pays employees | **Gusto** (payroll provider), never Stripe | Employee's bank by direct deposit |

Stripe doesn't withhold taxes, file payroll taxes or produce W-2s, so wages and tips go through payroll.

## Payroll with Gusto

**What Gusto is:** an online payroll service for small businesses. It calculates pay and taxes,
files them with the IRS and California, and direct-deposits paychecks. The owner pays Gusto
directly (roughly $50/month plus about $6 per employee). We only send it hours.

### Setup (owner, once)
1. Admin → Settings → Payroll → **Connect Gusto**, which sends the owner to Gusto's own sign-in and
   approval page (OAuth: Gusto asks "allow The Hood's site to send hours?") and back.
2. **Match employees:** each person in our Team list is paired with their Gusto employee
   (auto-matched by email, fixed by hand if needed). Employees' bank details, SSNs and W-4s
   are entered **in Gusto by the employee**, never in our app.

### Each pay period
1. Manager approves timesheets (Admin → Timesheets → Approve week).
2. Owner taps **Send to Gusto**. We send regular hours, overtime hours, double-time hours
   and **card tips** per employee for the pay period (from `time_entries` and tip pooling rules).
3. Owner reviews and submits payroll in Gusto. Gusto runs direct deposit on payday.

- If Gusto rejects a line (unmatched employee, locked pay period), the timesheet shows the
  error and nothing is half-sent. Each send is recorded in `payroll_syncs`.
- No Gusto? The CSV export stays available (Gusto, ADP, QuickBooks Payroll column formats).
- Other providers (ADP, Square Payroll) can follow the same `PayrollProvider` interface later.

## Deposits for private events and catering

**What it is:** from the Requests inbox, the owner taps **Send deposit link** on a private event
or catering request, enters the amount (default from config, e.g. $200 or 25%), and the customer
gets an email with a Stripe-hosted payment page.

- Payment methods: card, Apple/Google Pay, and **bank transfer (ACH Direct Debit)**. Bank
  transfer costs 0.8% capped at $5 (vs about 3% on a card), so a $500 deposit costs $5 instead of ~$15.
- Bank transfers take about 4 business days to clear and can fail (insufficient funds), so the
  request shows **Deposit pending** until Stripe confirms, then **Deposit paid**.
- Works in both payment modes (Connect and bring-your-own-key) through `PaymentProvider.createPaymentLink`.
- The deposit is applied to the final bill. Refund rules (e.g. full refund up to 7 days before)
  come from the Terms page and the owner's settings.

Webhooks: `checkout.session.completed` (card, or bank transfer started) → Deposit pending or paid;
`checkout.session.async_payment_succeeded` → Deposit paid;
`checkout.session.async_payment_failed` → back to Quoted, email the owner.

## Data

| Table | Key columns |
|---|---|
| `payroll_connections` | `id, location_id, provider (gusto), company_id, token_ref (encrypted, env-keyed), connected_at, connected_by` |
| `payroll_employee_links` | `employee_id, provider_employee_id` |
| `payroll_syncs` | `id, period_start, period_end, status (sent/failed), payload_hash, error?, sent_by, sent_at` |
| `form_submissions` (added columns) | `deposit_cents?, deposit_status (none/pending/paid/failed/refunded), deposit_payment_ref?` |
