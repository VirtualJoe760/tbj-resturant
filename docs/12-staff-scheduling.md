# 12 — Staff Scheduling & Time Clock

Employees use the same PWA as customers. After a staff member signs in, the app switches to
the **staff portal**: a schedule, a time clock, and their availability. Owners and managers
build the schedule in admin.

## Who does what

| Person | Can |
|---|---|
| **Employee** (staff role) | Join via invite, view own schedule + who else is working, clock in/out, take breaks, set preferred days, request time off, ask for or pick up shift cover |
| **Manager** | Build and publish schedules for their location, approve time off and shift cover, edit and approve timesheets |
| **Owner** | Everything, plus pay rates, invites, payroll export |

## Joining (account creation)

Accounts are **invite-only** so strangers can't sign up as staff.

1. Owner: Admin → More → Team & invites → **Invite**: name, phone/email, position(s), pay rate (owner-only field).
2. Employee gets a text/email with a link + code (e.g. `HOOD-7Q2K`, expires in 7 days).
3. They confirm name, email and mobile, and choose a password (Better Auth email + password).
4. The app prompts them to install it to the home screen and turn on shift notifications.

Removing an employee ends their sessions immediately and keeps their time records for payroll.

All account types are compared in [13-accounts-roles](13-accounts-roles.md).

## Staff portal (bottom bar: Schedule · **Clock** · Availability)

### Schedule
- "Next shift" card (date, times, position, hours) with a **Clock in** shortcut.
- Week list of my shifts; toggle to **Whole team** to see who's working each day.
- Only **published** schedules are visible. Changes after publishing notify affected people.

### Time clock
- Big **Clock in** / **Clock out** button, **Start/End break**, live current time.
- **Location check:** clock-in works only within ~150 m of the location (browser geolocation,
  asked once). Outside the fence → "You're not at The Hood" with a "Request manager approval" fallback.
- Early clock-in more than 10 minutes before a shift needs manager approval (configurable).
- History of this week's entries; tap one to request a correction.
- **Kiosk mode (optional):** a tablet at the bar runs `/staff/kiosk`; employees tap their name
  and enter a 4-digit PIN. Useful for staff without smartphones.

### Availability
- Per weekday: **Prefer** / **OK** / **Can't**.
- Preferred shifts: Day (2–8 PM) / Night (8 PM–2 AM) / Either.
- Max hours per week, notes for the manager.
- **Time off requests** (date range + reason) → manager approves or denies → employee notified.

### Shift cover (Schedule → Shift cover)
When someone can't make a published shift:
1. **Ask for cover:** the employee taps a shift → *Ask for cover* (optional note). Teammates
   with the same position get a push: "Taylor needs cover Sun 4 PM–12 AM."
2. **Pick it up:** teammates see it under *Up for grabs*, with their own warnings (would put
   you over your max hours, overlaps your shift, you marked Sunday as can't). They tap *I'll take it*.
3. **Manager approves:** the request shows in Admin → Schedule (and on the Home dashboard) as
   "Alex covers Taylor" with the same conflict warnings. Approve moves the shift to Alex;
   Deny keeps it with Taylor. Both get notified.
- The original person **stays responsible** until it's approved. Unclaimed requests remind
  the manager 24 hours before the shift.
- Owners can turn on **auto-approve** when the pickup has no warnings.
- A direct swap ("I'll take your Friday if you take my Saturday") is two linked cover requests,
  approved together.

## Admin: schedule builder (Admin → Schedule)

- **Week grid:** team members as rows, days as columns, weekly hours at the end, daily totals at the bottom.
  Cells are shaded by availability (green = prefers, hatched = can't work). Scrolls sideways on phones; first column sticks.
- **Tap a cell** to add or edit a shift: day, position, team member (dropdown shows each
  person's availability and current hours), start, end. Shifts may end after midnight.
- **Live warnings** (saving is still allowed; the shift gets a red outline):
  - marked "can't work" that day
  - time off approved or pending
  - overlaps another shift
  - over 8 hours in a day / over 40 in a week (California daily and weekly overtime)
  - over the employee's own max hours
- Summary: total hours, **estimated labor cost** (from pay rates), number of flagged shifts.
- **Copy last week**, **Publish & notify team** (push + text + email). Status: Published / Unpublished changes.
- Pending time-off and **shift cover** requests at the top with Approve / Deny.
- Later: open shifts (unassigned) staff can claim, labor % of sales, auto-fill from availability.

## Admin: timesheets (Admin → Schedule → Timesheets)

- **On the clock now** with location verification.
- Per employee per week: scheduled hours vs worked hours, flags (overtime, missed meal break,
  late clock-out, missing clock-out), manager edits with a required reason (audit trail).
- **Approve week** → **Export CSV** for payroll (Gusto/ADP/QuickBooks column formats), or
  **Send to Gusto** when the optional payroll connection is on ([14](14-payroll-deposits.md)).
- Forgotten clock-outs: auto-flag 30 minutes after closing; the manager sets the actual time.

## California labor notes

Built-in flags follow common California rules: daily overtime over 8 hours and double time
over 12, weekly overtime over 40, a 30-minute meal break before the end of the 5th hour, and
paid 10-minute rest breaks per 4 hours. Rules live in a config object per location so other
states can use their own. **These are reminders, not legal advice.** The owner should confirm
with their payroll provider.

## Data

| Table | Key columns |
|---|---|
| `employees` | `id, user_id, location_id, display_name, phone, positions text[], primary_position, pay_rate_cents (owner-only), color, status (active/inactive), kiosk_pin_hash?, hired_on` |
| `staff_invites` | `code, location_id, name, phone?, email?, positions, pay_rate_cents?, expires_at, used_at?` |
| `availability` | `employee_id, weekday, state (prefer/ok/no), preferred_window (day/night/either), max_hours_week, note, updated_at` |
| `time_off_requests` | `id, employee_id, starts_on, ends_on, reason, status (pending/approved/denied), decided_by, decided_at` |
| `schedules` | `id, location_id, week_start (date), status (draft/published), published_at, published_by` |
| `shifts` | `id, schedule_id, employee_id? (null = open shift), position, starts_at, ends_at (timestamptz, may cross midnight), break_minutes, note` |
| `time_entries` | `id, employee_id, location_id, shift_id?, clock_in_at, clock_out_at?, breaks jsonb [{start,end}], method (app/kiosk/manager), in_lat, in_lng, in_accuracy_m, edited_by?, edit_reason?, approved_at?` |
| `shift_cover_requests` | `id, shift_id, from_employee_id, claimed_by_employee_id?, note, status (open/claimed/approved/denied/cancelled), linked_request_id? (swaps), decided_by?, decided_at?, created_at` |
| `labor_rules` | `location_id, rules jsonb` (overtime thresholds, break rules, geofence radius, early clock-in window) |

All schedule/clock writes go through `src/domain/scheduling.ts` (warnings) and
`src/domain/timeclock.ts` (clock state machine: off → on → on_break → on → off).

## Notifications

| When | To | How |
|---|---|---|
| Schedule published / shift changed | Affected staff | Push + text + email |
| 1 hour before shift | Employee | Push |
| Time off decided | Employee | Push + email |
| Cover requested | Same-position teammates | Push |
| Cover claimed | Managers | Push + admin badge |
| Cover approved / denied | Both employees | Push + text |
| Time off requested, correction requested | Managers | Push + admin badge |
| Still clocked in 30 min after close | Employee + manager | Push |
