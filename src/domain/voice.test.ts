import { describe, expect, it } from "vitest";
import { parseSpokenModifiers } from "./voice";
import { describeSelections, validateSelections } from "./cart";
import { priceLine, type ItemDef } from "./pricing";

const og: ItemDef = {
  id: "og", name: "OG Combo", basePriceCents: 900,
  groups: [
    { id: "size", name: "Size", kind: "choice", min: 1, max: 1, mods: [{ id: "slice", name: "Jumbo slice (2 big slices)", priceCents: 0, isDefault: true }, { id: "whole", name: "Whole pie", priceCents: 1900 }] },
    { id: "og", name: "Comes with", kind: "removal", min: 0, max: 3, mods: [
      { id: "og-sausage", name: "Sausage", priceCents: 0, isDefault: true },
      { id: "og-green-peppers", name: "Green peppers", priceCents: 0, isDefault: true },
      { id: "og-mozzarella", name: "Mozzarella", priceCents: 0, isDefault: true, extraPriceCents: 150 }] },
    { id: "tops", name: "Add toppings", kind: "addon", min: 0, max: 5, mods: [
      { id: "t-onion", name: "Onions", priceCents: 150 }, { id: "t-mush", name: "Mushrooms", priceCents: 150 }, { id: "t-saus", name: "Sausage", priceCents: 250 }] },
  ],
};

describe("voice modifiers", () => {
  it("whole pie, hold the sausage, add onions, extra cheese, mushrooms on half", () => {
    const r = parseSpokenModifiers(og, "whole pie, hold the sausage, add onions, extra cheese, mushrooms on half");
    expect(r.unmatched).toEqual([]);
    expect(validateSelections(og, r.selections).ok).toBe(true);
    expect(describeSelections(og, r.selections).map((d) => d.label)).toEqual(["Whole pie", "NO Sausage", "EXTRA Mozzarella", "ADD Onions", "ADD Mushrooms (left half)"]);
    expect(priceLine(og, r.selections)).toBe(900 + 1900 + 150 + 150 + 75);
  });
  it("no peppers resolves to the green peppers it comes with; unknown words are reported", () => {
    const r = parseSpokenModifiers(og, "no peppers and add anchovies");
    expect(r.selections["og-green-peppers"].action).toBe("remove");
    expect(r.unmatched).toEqual(["add anchovies"]);
  });
});
