# 04 — Voice Ordering (Retell)

Callers phone the restaurant's number; a Retell AI agent takes the order in natural speech
and builds a real order through our API. It never invents items or prices — every fact comes
from a function call.

## Call flow

```
Caller ─► Retell number ─► Agent greets ("Thanks for calling Tony's, pickup order?")
   │
   ├─ get_store_status        open? wait time? location (chains: ask which one / use number)
   ├─ search_menu("pepperoni pizza")         → candidates with ids
   ├─ get_item("large-pepperoni")            → modifier groups + rules, spoken summary
   ├─ add_to_cart(item, selections)          → validated line or errors ("size is required")
   ├─ update_line / remove_line
   ├─ get_cart                               → read-back + total
   ├─ set_customer(name, phone)
   ├─ choose_pickup_time("asap" | "6:30")
   ├─ submit_order(pay: "link" | "at_pickup")
   │     link     → Stripe payment link sent by SMS; order waits in pending_payment
   │     at_pickup→ order goes straight to kitchen (owner can disable this option)
   └─ transfer_to_staff                      → warm transfer to the restaurant's line
```

## Handling modifications

The agent maps speech to modifier actions using `modifiers.voice_aliases` plus fuzzy search:

| Caller says | Resolved as |
|---|---|
| "hold the sausage" / "no sausage" | `removal` group, Sausage → `action: remove` |
| "add onions" | `addon` group, Onions → `action: add, quantity: normal` |
| "extra cheese" | Cheese → `quantity: extra` (+price) |
| "light sauce" | Sauce → `quantity: light` |
| "mushrooms on half" | Mushrooms → `placement: left` (agent asks which half only if it matters) |
| "make it a large" | Size choice → Large (re-prices line) |
| "the usual" (known phone) | `get_last_order(phone)` → offer to repeat |

If the alias is ambiguous ("peppers" → bell or banana?), the function returns candidates and
the agent asks a short clarifying question.

## Function endpoints

All under `/api/voice/*`, `POST`, JSON in/out, verified with Retell's signature header, keyed
by `call_id` so the cart is per call. Responses include a `say` field — a short,
speakable summary — plus structured data.

```jsonc
// POST /api/voice/add_to_cart
{ "call_id": "abc", "item_id": "pizza-pepperoni",
  "selections": [
    { "modifier_id": "size-large" },
    { "modifier_id": "top-sausage", "action": "remove" },
    { "modifier_id": "top-onion", "action": "add" } ] }

// → 200
{ "ok": true, "line_id": "l1", "line_total_cents": 2149,
  "say": "Large pepperoni, no sausage, add onions — twenty-one forty-nine." }

// → 200 (validation problem, not an HTTP error so the agent can recover)
{ "ok": false, "errors": [{ "code": "required_group", "group": "Crust",
  "options": ["Thin", "Regular", "Deep dish"] }],
  "say": "What crust would you like — thin, regular, or deep dish?" }
```

## Agent prompt rules (summary)

- Open every call with a short recording notice ("This call may be recorded"). California
  requires consent from everyone on a recorded call; the notice is in the agent template and
  the privacy policy.
- Confirm each item back after adding it; read the full order and total before submitting.
- Never quote a price that didn't come from a function result.
- Only offer items/modifiers returned by the API; if something is 86'd, say so and suggest the
  closest alternative from `search_menu`.
- Keep turns short; one question at a time.
- Escalate to staff on: complaints, allergies beyond tags, large catering orders, 2 failed
  clarifications in a row, or caller request.
- Allergy statements are passed into `special_instructions` and flagged on the kitchen ticket.

## Config & ops

- One Retell agent per restaurant, created by the setup script from a template
  (`/src/voice/agent-template.json`) with brand name, hours, and function URLs filled in.
- Chains: one number per location (location resolved from the dialed number), or one main
  number where the agent asks which location.
- `voice_calls` stores outcome, duration, transcript link; admin has a **Calls** page.
- Test harness: scripted transcripts (`/tests/voice/*.yaml`) replayed against the function
  endpoints to catch regressions when the menu changes.
