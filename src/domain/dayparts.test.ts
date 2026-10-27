import { describe, expect, it } from "vitest";
import { categoryAvailability, daypartLabel, servingNow, type Daypart } from "./dayparts";

const tz = "America/Los_Angeles";
// 2026-10-27 is a Tuesday; 9 AM / 1 PM / 1 AM Pacific (UTC-7 in October)
const at = (h: number, day = 27) => new Date(Date.UTC(2026, 9, day, h + 7));
const breakfast: Daypart = { id: "b", name: "Breakfast", startsAt: "07:00", endsAt: "11:00", days: [0, 1, 2, 3, 4, 5, 6] };
const late: Daypart = { id: "l", name: "Late night", startsAt: "22:00", endsAt: "02:00", days: [5, 6] };
const brunch: Daypart = { id: "w", name: "Brunch", startsAt: "09:00", endsAt: "14:00", days: [0, 6] };

describe("menu times", () => {
  it("categories with no menu times are always available", () => {
    expect(categoryAvailability([], [breakfast], tz, at(13))).toEqual({ availableNow: true, label: null });
  });
  it("breakfast is orderable in the morning only", () => {
    expect(categoryAvailability(["b"], [breakfast], tz, at(9)).availableNow).toBe(true);
    expect(categoryAvailability(["b"], [breakfast], tz, at(13)).availableNow).toBe(false);
    expect(daypartLabel(breakfast)).toBe("Breakfast · 7 AM – 11 AM");
  });
  it("late night runs past midnight into the next day", () => {
    // Saturday 1 AM is Friday's late night
    expect(categoryAvailability(["l"], [late], tz, at(1, 31)).availableNow).toBe(true);
    expect(categoryAvailability(["l"], [late], tz, at(1, 28)).availableNow).toBe(false);
  });
  it("weekend-only dayparts say so", () => {
    expect(daypartLabel(brunch)).toBe("Brunch · 9 AM – 2 PM · Sat & Sun");
    expect(servingNow([breakfast, brunch], tz, at(9))).toEqual(["Breakfast"]);
  });
});
