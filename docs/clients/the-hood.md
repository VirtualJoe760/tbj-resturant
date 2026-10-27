# Client #1 — The Hood Bar & Pizza (Palm Desert, CA)

First restaurant built on the template. Source: public Yelp listing and Yelp menu, read
2026-10-26. Everything marked **TBD** needs confirming with the owner (Brad, per reviews).

## Profile

| Field | Value |
|---|---|
| Name | The Hood Bar & Pizza |
| Address | 74360 Hwy 111, Palm Desert, CA 92260 |
| Timezone | America/Los_Angeles |
| Hours | Every day 2:00 PM – 2:00 AM (crosses midnight) |
| Type | Dive bar + scratch-made pizza; patio, pool tables, arcade |
| Offers | Take-out, delivery (via third party, TBD which), reservations |
| Phone | TBD |
| Domain / brand colors / logo | TBD — mock uses a placeholder dark theme with amber accent |
| Stripe | TBD — Connect (default) or their existing account |

## What this client adds to the template

| Need | Template change |
|---|---|
| Open 2 PM–2 AM | `location_hours` must support **closing after midnight** (closes_at < opens_at = next day). Slot generation and "open now" must handle it. Added to [02-data-model](../02-data-model.md). |
| Live music, drag bingo, karaoke, trivia nights | New optional **Events** feature: `events` table + `/events` page + newsletter "event block". Flag: `features.events`. |
| Full bar (beer, seltzers, wine) | Alcohol shown on menu as **dine-in only / not orderable online** by default (`items.orderable_online=false`). To-go alcohol is a legal question for the owner, not a default. |
| A reviewer's phone order lost the sandwich | Strong case for the **voice agent**: every item is read back and confirmed before submit. |
| Slice vs whole pie | Size group with "Jumbo slice" as a choice; whole-pie prices TBD. |
| Wings sauce choice, "add chicken" upsells | Standard `choice` and `addon` modifier groups — fits the existing model. |

## Draft menu (from Yelp; prices may be outdated)

### Starters — "To Begin… Your Hood Experience"
| Item | Price | Modifiers |
|---|---|---|
| Jalapeño or Mushroom Poppers (10) | $10.95 | Choice: Jalapeño / Mushroom. Contains bacon |
| Chicken Wings (10) | $15.95 | Sauce choice: Red Hot Buffalo / Daytona (mild) / BBQ |
| Nachos | $11.50 | Add chicken (+TBD) |
| Chicken Tenders (4) | $9.00 | Dipping sauce choice |
| Killer Tots | $10.95 | Removal: bacon |
| Lethal Tots | $13.95 | Removal: bacon, jalapeños |
| Cheesier Bread | $8.00 | — |
| Mozzarella Sticks (6) | $9.95 | — |
| Tot-Cho's | $13.95 | Removal: onions, olives, jalapeños, tomatoes |

### Salads & sandwiches
| Item | Price | Modifiers |
|---|---|---|
| House Salad | $8.95 | Dressing choice (TBD) |
| Greek Salad | $10.50 | Removal: olives, onion, feta |
| Caesar Salad | $9.50 | Add chicken (+TBD) |
| BBQ Chicken Salad | $13.95 | Removal: bacon, onion |
| Beef or Chicken Philly (w/ fries) | $14.95 | Choice: Beef / Chicken. Removal: onion, green pepper, mushroom |

### Pizza — house specialties ($9.00 on Yelp; likely the jumbo slice price — TBD)
OG Combo · California · Aloha · Greek · Slaughter House · BBQ Chicken · Buffalo Chicken ·
Chicken Alfredo · Jalapeño Popper · Zed's · Sweet and Spicy Pepperoni.
Each specialty's toppings become a **removal** group ("hold the sausage"), plus the shared
**Add toppings** group, size, and light/extra/half.

### Pizza — create your own
Listed on Yelp with no items. Needs: sizes + prices, sauce options, topping list + prices. **TBD.**

### Drinks (display only by default)
Domestic, import, premium beers; White Claw; Truly; Truly Tequila Seltzer; bottled wine / sparkling.

## Questions for the owner
1. Whole-pie sizes and prices; is $9 the slice price?
2. Create-your-own topping list and prices; gluten-free crust?
3. Phone number to forward to the voice agent, and should staff still answer first?
4. Online alcohol to-go: yes/no?
5. Current delivery partner (keep it, or add in-house later)?
6. Existing Stripe account, or set up new through Connect?
7. Logo, colors, photos; domain they own?
8. Event calendar source (weekly bingo/karaoke schedule)?
