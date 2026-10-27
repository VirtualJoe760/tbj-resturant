# 13 — Accounts & Roles

Five kinds of accounts share one app. What you see after signing in depends on your role.

| Account | Who | Signs in with | Lands on |
|---|---|---|---|
| **Webmaster** | Us (the agency that builds and runs the site) | Email + password, 2-step required | Admin, plus Webmaster tools |
| **Owner** | Restaurant owners (one or more) | Email + password (Google / Facebook later) | Admin dashboard |
| **Manager** *(optional)* | Someone the owner trusts to run a shift | Email + password | Admin, limited (below) |
| **Kitchen** | A shared tablet on the line, not a person | Kitchen account email + password, or a one-time pairing code | Kitchen screen |
| **Employee** | Bartenders, cooks, servers, door | Invite code, then email + password | Staff portal |
| **Customer** *(optional)* | Guests who order | Email + password (Google / Facebook later); guest checkout always allowed | Home / menu |

## Sign-in methods

One sign-in page for everyone (`/login`); the role decides where you land.

| Method | When | Notes |
|---|---|---|
| **Email + password** | Built now, every site | Better Auth email/password. "Forgot password" emails a reset link |
| **Continue with Google** | Last step, after the restaurant signs with us | Needs a Google OAuth app (sign-in key) set up for the client's domain |
| **Continue with Facebook** | Last step, after the restaurant signs with us | Needs a Facebook (Meta) app for the client's domain; Meta reviews it |

The Google and Facebook buttons are in the UI from the start but disabled ("coming soon")
until `promote` sets up the keys. Social sign-in only applies to owners, managers and
customers; employees and the kitchen always use email + password.

## Test accounts (one per account type)

Every site is seeded with four test accounts so we can sign in as each role and try every feature.
The password is the shared test password in `src/db/test-accounts.ts`.

| Email | Account type | Lands on |
|---|---|---|
| `admin@<domain>` | Admin (owner role) | Admin dashboard |
| `employee@<domain>` | Employee (sample bartender with shifts, availability, timesheet) | Staff portal |
| `kitchen@<domain>` | Kitchen | Kitchen screen + 86 board |
| `customer@<domain>` | Customer (sample order history, favorites) | Home / menu |

`<domain>` is the restaurant's domain if they have one (e.g. `admin@thehoodpalmdesert.com`),
otherwise `<slug>.com`. These addresses never receive mail: demo email goes to the Demo inbox.

**Live sites:** a shared, known password must not stay usable on a real site. `promote` keeps
the four test accounts but disables them by default. The webmaster can turn them on for
testing from Webmaster tools, which forces a new random password shown once. Real people get
their own accounts (owner invite, employee invites).

## What each role can do

| Area | Webmaster | Owner | Manager | Kitchen | Employee | Customer |
|---|---|---|---|---|---|---|
| Place orders, see own order history | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Kitchen screen: see incoming orders, start / ready / picked up | ✓ | ✓ | ✓ | ✓ | if allowed | – |
| 86 an item (sold out until end of day) | ✓ | ✓ | ✓ | ✓ | if allowed | – |
| Edit menu items, prices, modifiers, photos | ✓ | ✓ | ✓ | – | – | – |
| Add events, home-page specials | ✓ | ✓ | ✓ | – | – | – |
| Create pages and forms | ✓ | ✓ | – | – | – | – |
| **Requests inbox** (bands, private events, catering) | ✓ | ✓ | ✓ | – | – | – |
| Job applications | ✓ | ✓ | ✓ | – | – | – |
| Orders, refunds | ✓ | ✓ | ✓ (refunds up to a limit) | – | – | – |
| Build and publish the schedule, approve time off and shift cover | ✓ | ✓ | ✓ | – | – | – |
| Clock in/out, availability, time off, shift cover | – | if on staff | if on staff | – | ✓ | – |
| Timesheets, payroll export / Gusto | ✓ | ✓ | approve only | – | own hours | – |
| Pay rates | – | ✓ | – | – | own rate | – |
| Newsletter, promo codes, reports | ✓ | ✓ | reports | – | – | – |
| Team & access (invite employees, managers, pair kitchen tablets) | ✓ | ✓ | invite employees | – | – | – |
| Payments setup (Stripe), payroll connection | ✓ | ✓ | – | – | – | – |
| **Webmaster tools**: domain, integrations, payment mode, feature flags, backups, legal templates | ✓ | – | – | – | – | – |

"if allowed" = the owner turns on kitchen access for that employee (e.g. cooks).

## Role notes

**Webmaster.** Our account exists on every client deploy and is set by an environment variable
(`WEBMASTER_EMAILS`), not by a database row. An owner can't remove or lock out the webmaster by mistake.
Pay rates are hidden from the webmaster by default. Every webmaster action is written to
`audit_log` so the owner can see what we changed. When a client leaves, we remove the variable.

**Owner.** Full control of the business. A restaurant can have several owners (partners). The
first owner is created by the setup script.

**Manager (optional).** Off by default for small shops. When on, it covers someone who runs
nights and needs the schedule, requests and refunds but not payroll or settings.

**Kitchen (shared device).** This is not a person, so there is no email or password.
1. Owner: More → Team & access → **Pair a kitchen tablet**, which shows a 6-digit code (valid 10 minutes).
2. On the tablet, open `/kitchen` and enter the code. The tablet stays signed in (long-lived
   device session) and only ever shows the Kitchen screen and 86 board.
3. Lost or replaced tablet: owner taps **Unpair**, which ends that session.
The kitchen sees ticket details (name, pickup time, items, notes) but no sales totals, reports
or customer lists.

**Employee.** Invite-only. See [12-staff-scheduling](12-staff-scheduling.md).

**Customer.** An account is optional; guests check out with name, phone and email. Signing in
adds order history, one-tap reorder, favorites, saved cards (stored by Stripe, not us) and
email preferences. A customer can delete their account from Account → Privacy.

## One person, several roles

An owner who also tends bar gets both an owner membership and an employee record. The app
shows a **role switcher** (Admin ↔ My shifts) in the account menu. Permissions are the union
of their roles.

## How it's enforced

- v1 (built): `user.role` is one of `admin | manager | employee | kitchen | customer`; webmaster
  comes from `WEBMASTER_EMAILS`. Chain mode moves this to `memberships (user_id, role, location_id?)`
  and adds `devices` for paired kitchen tablets.
- Every server action calls `requireRole([...], locationId)`. The UI hides what you can't use,
  but the server check is the real gate.
- Routes: `/admin/*` (owner, manager, webmaster), `/kitchen` (kitchen device, plus anyone with
  kitchen access), `/staff/*` (employees), everything else public or customer.

## Data

| Table | Key columns |
|---|---|
| `memberships` | `user_id, role (owner/manager/staff), location_id?, kitchen_access bool` |
| `devices` | `id, location_id, name ("Line tablet"), kind (kitchen/kiosk), paired_at, last_seen_at, revoked_at?` |
| `device_pairing_codes` | `code_hash, location_id, kind, expires_at, used_at?` |
| `audit_log` | `id, actor (user id or "webmaster:<email>" or device id), action, target, before jsonb, after jsonb, at` |
