import { describe, expect, it } from "vitest";
import { defaultSelections, priceCart, priceLine, type ItemDef } from "./pricing";
import { describeSelections, validateSelections } from "./cart";
import { isOpenAt, summarizeHours } from "./hours";
import { canTransition } from "./orders";
import { clockNext, shiftHours, shiftWarnings } from "./scheduling";

const og: ItemDef = {
  id: "og",
  name: "OG Combo",
  basePriceCents: 900,
  groups: [
    { id: "size", name: "Size", kind: "choice", min: 1, max: 1, mods: [
      { id: "slice", name: "Jumbo slice", priceCents: 0 },
      { id: "whole", name: "Whole pie", priceCents: 1900 },
    ] },
    { id: "comes", name: "Comes with", kind: "removal", min: 0, max: 9, mods: [
      { id: "saus", name: "Sausage", priceCents: 0, isDefault: true },
      { id: "moz", name: "Mozzarella", priceCents: 0, isDefault: true, extraPriceCents: 150 },
    ] },
    { id: "tops", name: "Add toppings", kind: "addon", min: 0, max: 2, mods: [
      { id: "onion", name: "Onions", priceCents: 150 },
      { id: "bacon", name: "Bacon", priceCents: 250 },
      { id: "jal", name: "Jalapeños", priceCents: 150 },
    ] },
  ],
};

describe("pricing", () => {
  it("defaults: first size, removal toppings kept", () => {
    const s = defaultSelections(og);
    expect(s.slice.action).toBe("choose");
    expect(s.saus.action).toBe("keep");
    expect(priceLine(og, s)).toBe(900);
  });

  it("hold the sausage, add onions, whole pie", () => {
    const s = defaultSelections(og);
    delete s.slice;
    s.whole = { action: "choose" };
    s.saus = { action: "remove" };
    s.onion = { action: "add", qty: "normal", place: "whole" };
    expect(priceLine(og, s)).toBe(900 + 1900 + 150);
    expect(describeSelections(og, s).map((d) => d.label)).toEqual(["Whole pie", "NO Sausage", "ADD Onions"]);
  });

  it("extra charges double, half charges half, extra cheese on a removal group", () => {
    const s = defaultSelections(og);
    s.bacon = { action: "add", qty: "extra", place: "whole" };
    s.onion = { action: "add", qty: "normal", place: "left" };
    s.moz = { action: "keep", qty: "extra" };
    expect(priceLine(og, s)).toBe(900 + 500 + 75 + 150);
  });

  it("cart totals with tax, tip and discount", () => {
    const t = priceCart([{ unitCents: 1000, quantity: 2 }], { taxRate: 0.0875, tipPct: 0.15, discountCents: 500 });
    expect(t).toEqual({ subtotal: 2000, discount: 500, tax: 131, tip: 225, total: 1856 });
  });
});

describe("validation", () => {
  it("requires a size", () => {
    const s = defaultSelections(og);
    delete s.slice;
    expect(validateSelections(og, s).errors).toContain("Choose a size");
  });
  it("caps add-ons and rejects unknown options", () => {
    const s = defaultSelections(og);
    s.onion = s.bacon = s.jal = { action: "add" };
    s.nope = { action: "add" };
    const r = validateSelections(og, s);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("Add toppings: up to 2");
    expect(r.errors.some((e) => e.includes("nope"))).toBe(true);
  });
});

describe("hours across midnight", () => {
  const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "14:00", closesAt: "02:00" }));
  it("open at 1 AM (yesterday's shift), closed at 3 AM and noon", () => {
    expect(isOpenAt(rows, 2, 60)).toBe(true);
    expect(isOpenAt(rows, 2, 180)).toBe(false);
    expect(isOpenAt(rows, 2, 720)).toBe(false);
    expect(isOpenAt(rows, 2, 15 * 60)).toBe(true);
  });
  it("summarizes", () => expect(summarizeHours(rows)).toEqual(["Every day 2 PM – 2 AM"]));
});

describe("orders + scheduling", () => {
  it("state machine", () => {
    expect(canTransition("paid", "preparing")).toBe(true);
    expect(canTransition("ready", "preparing")).toBe(false);
  });
  it("overnight shift hours and warnings", () => {
    expect(shiftHours({ start: "18:00", end: "02:00" })).toBe(8);
    const emp = { id: "a", name: "Alex M.", maxHoursWeek: 10, avail: ["prefer", "ok", "ok", "no", "ok", "ok", "ok"] as const };
    const shifts = [{ id: "1", employeeId: "a", date: "2026-10-26", start: "18:00", end: "02:00" }];
    const w = shiftWarnings(
      { employeeId: "a", date: "2026-10-29", start: "14:00", end: "23:30" },
      { employee: { ...emp, avail: [...emp.avail] }, weekShifts: shifts, timeOff: [] },
    );
    expect(w).toContain("Alex can't work Thursdays");
    expect(w.some((x) => x.includes("daily overtime"))).toBe(true);
    expect(w.some((x) => x.includes("over Alex's max"))).toBe(true);
  });
  it("clock", () => {
    expect(clockNext("off", "in")).toBe("on");
    expect(() => clockNext("off", "out")).toThrow();
  });
});
