import type { ItemDef, Selections } from "./pricing";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Checks selections against the item's modifier rules. Unknown modifier ids are rejected. */
export function validateSelections(item: ItemDef, sel: Selections): ValidationResult {
  const errors: string[] = [];
  const known = new Set(item.groups.flatMap((g) => g.mods.map((m) => m.id)));
  for (const id of Object.keys(sel)) if (!known.has(id)) errors.push(`Unknown option "${id}"`);

  for (const g of item.groups) {
    if (g.kind === "removal") {
      for (const m of g.mods) {
        const s = sel[m.id];
        if (s && !["keep", "remove"].includes(s.action)) errors.push(`${m.name}: can only keep or remove`);
      }
      continue;
    }
    const chosen = g.mods.filter((m) => sel[m.id] && sel[m.id].action !== "remove").length;
    if (chosen < g.min) errors.push(g.min === 1 ? `Choose a ${g.name.toLowerCase()}` : `${g.name}: choose at least ${g.min}`);
    if (chosen > g.max) errors.push(`${g.name}: up to ${g.max}`);
    if (g.kind !== "addon") {
      for (const m of g.mods) {
        const s = sel[m.id];
        if (s && (s.qty === "extra" || s.qty === "light" || (s.place && s.place !== "whole")))
          errors.push(`${m.name}: light/extra/half only apply to toppings`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export interface DescribedModifier {
  action: "add" | "remove" | "choose" | "extra" | "light";
  label: string; // kitchen ticket text, e.g. "NO Sausage", "ADD Onions (left half)"
  name: string;
  groupName: string;
  qty: "light" | "normal" | "extra";
  place: "whole" | "left" | "right";
}

/** Human/kitchen-readable modifiers. Kept defaults are omitted (they're implied). */
export function describeSelections(item: ItemDef, sel: Selections): DescribedModifier[] {
  const out: DescribedModifier[] = [];
  for (const g of item.groups) {
    for (const m of g.mods) {
      const s = sel[m.id];
      if (!s) continue;
      const qty = s.qty ?? "normal";
      const place = s.place ?? "whole";
      const half = place !== "whole" ? ` (${place} half)` : "";
      const base = { name: m.name, groupName: g.name, qty, place };
      if (s.action === "remove") out.push({ ...base, action: "remove", label: `NO ${m.name}` });
      else if (g.kind === "removal") {
        if (qty === "extra") out.push({ ...base, action: "extra", label: `EXTRA ${m.name}` });
      } else if (g.kind === "addon") {
        const verb = qty === "extra" ? "EXTRA" : qty === "light" ? "LIGHT" : "ADD";
        out.push({ ...base, action: "add", label: `${verb} ${m.name}${half}` });
      } else out.push({ ...base, action: "choose", label: m.name });
    }
  }
  return out;
}
