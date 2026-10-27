// The ONLY place money is computed. Web, voice, receipts and the kitchen all call these.
// All amounts are integer cents.

export type GroupKind = "choice" | "addon" | "removal" | "option";
export type QtyLevel = "light" | "normal" | "extra";
export type Placement = "whole" | "left" | "right";

export interface ModifierDef {
  id: string;
  name: string;
  priceCents: number;
  extraPriceCents?: number | null; // removal groups: charge for "extra cheese"
  isDefault?: boolean;
}

export interface GroupDef {
  id: string;
  name: string;
  kind: GroupKind;
  min: number;
  max: number;
  mods: ModifierDef[];
}

export interface ItemDef {
  id: string;
  name: string;
  basePriceCents: number;
  groups: GroupDef[];
}

export interface Selection {
  action: "choose" | "add" | "keep" | "remove";
  qty?: QtyLevel;
  place?: Placement;
}

export type Selections = Record<string, Selection>;

export interface CartLine {
  itemId: string;
  quantity: number;
  selections: Selections;
  instructions?: string;
}

/** Default selections when an item sheet opens: removal defaults kept, first choice picked. */
export function defaultSelections(item: ItemDef): Selections {
  const sel: Selections = {};
  for (const g of item.groups) {
    if (g.kind === "removal") {
      for (const m of g.mods) if (m.isDefault !== false) sel[m.id] = { action: "keep", qty: "normal" };
    } else if ((g.kind === "choice" || g.kind === "option") && g.min > 0 && g.mods[0]) {
      const def = g.mods.find((m) => m.isDefault) ?? g.mods[0];
      sel[def.id] = { action: "choose" };
    }
  }
  return sel;
}

/** Price of ONE unit of an item with the given selections. */
export function priceLine(item: ItemDef, sel: Selections): number {
  let cents = item.basePriceCents;
  for (const g of item.groups) {
    for (const m of g.mods) {
      const s = sel[m.id];
      if (!s || s.action === "remove") continue;
      if (g.kind === "removal") {
        if (s.qty === "extra") cents += m.extraPriceCents ?? 0;
        continue;
      }
      const half = s.place && s.place !== "whole" ? 0.5 : 1;
      const mult = s.qty === "extra" ? 2 : 1;
      cents += Math.round(m.priceCents * mult * half);
    }
  }
  return cents;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
}

export function priceCart(
  lines: { unitCents: number; quantity: number }[],
  opts: { taxRate: number; tipPct?: number; tipCents?: number; discountCents?: number },
): Totals {
  const subtotal = lines.reduce((a, l) => a + l.unitCents * l.quantity, 0);
  const discount = Math.min(opts.discountCents ?? 0, subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * opts.taxRate);
  const tip = opts.tipCents ?? Math.round(taxable * (opts.tipPct ?? 0));
  return { subtotal, discount, tax, tip, total: taxable + tax + tip };
}

export const money = (cents: number) =>
  (cents < 0 ? "-$" : "$") + (Math.abs(cents) / 100).toFixed(2);
