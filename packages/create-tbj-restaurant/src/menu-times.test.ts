import { describe, expect, it } from "vitest";
import { guessMenuTimes, parseRange } from "./menu-times.ts";

describe("menu times", () => {
  it("reads the ways owners write hours", () => {
    expect(parseRange("7-11")).toEqual(["07:00", "11:00"]);
    expect(parseRange("11-3")).toEqual(["11:00", "15:00"]);
    expect(parseRange("5-10")).toEqual(["17:00", "22:00"]);
    expect(parseRange("4:30pm - 10pm")).toEqual(["16:30", "22:00"]);
    expect(parseRange("10pm-2am")).toEqual(["22:00", "02:00"]);
    expect(parseRange("22:00-02:00")).toEqual(["22:00", "02:00"]);
    expect(parseRange("7am to 11am")).toEqual(["07:00", "11:00"]);
    expect(parseRange("breakfast")).toBeNull();
  });
  it("guesses menu times from section names", () => {
    expect(guessMenuTimes(["Breakfast Plates", "Burgers", "Lunch Specials"]).map((t) => [t.name, t.sections])).toEqual([["Breakfast", ["Breakfast Plates"]], ["Lunch", ["Lunch Specials"]]]);
  });
});
