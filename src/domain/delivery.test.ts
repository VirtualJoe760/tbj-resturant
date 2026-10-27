import { describe, expect, it } from "vitest";
import { demoCourierStatus, e164, formatAddress, fromDoorDash, fromUber, parseOneLine } from "./delivery";
import { alertText } from "./order-alerts";

describe("delivery", () => {
  it("maps DoorDash and Uber statuses onto one trip", () => {
    expect(["created", "confirmed", "arrived_at_pickup", "picked_up", "arrived_at_dropoff", "delivered", "cancelled"].map(fromDoorDash))
      .toEqual(["requested", "assigned", "at_pickup", "picked_up", "at_dropoff", "delivered", "cancelled"]);
    expect([fromUber("pending"), fromUber("pending", true), fromUber("pickup"), fromUber("pickup_complete"), fromUber("dropoff"), fromUber("delivered"), fromUber("returned")])
      .toEqual(["requested", "assigned", "assigned", "picked_up", "picked_up", "delivered", "cancelled"]);
  });
  it("formats phones and addresses the way the services want", () => {
    expect(e164("(760) 555-0134")).toBe("+17605550134");
    expect(e164("1-760-555-0134")).toBe("+17605550134");
    expect(parseOneLine("74360 Hwy 111, Palm Desert, CA 92260")).toEqual({ street: "74360 Hwy 111", city: "Palm Desert", state: "CA", zip: "92260" });
    expect(formatAddress({ street: "1 Main St", unit: "Apt 2", city: "Indio", state: "CA", zip: "92201" })).toBe("1 Main St Apt 2, Indio, CA 92201");
  });
  it("the demo driver follows the kitchen", () => {
    const booked = new Date("2026-10-27T18:00:00Z");
    const at = (s: number) => new Date(booked.getTime() + s * 1000);
    expect(demoCourierStatus(booked, null, at(5))).toBe("requested");
    expect(demoCourierStatus(booked, null, at(600))).toBe("assigned"); // food not ready yet
    const ready = at(600);
    expect(demoCourierStatus(booked, ready, at(610))).toBe("at_pickup");
    expect(demoCourierStatus(booked, ready, at(700))).toBe("picked_up");
    expect(demoCourierStatus(booked, ready, at(800))).toBe("at_dropoff");
    expect(demoCourierStatus(booked, ready, at(900))).toBe("delivered");
  });
});

describe("order alerts", () => {
  const o = { number: "A012", place: "The Hood" };
  it("tells pickup customers when it's started and ready", () => {
    expect(alertText("started", { ...o, fulfillment: "pickup" }).title).toBe("We started your order #A012");
    expect(alertText("ready", { ...o, fulfillment: "pickup" }).title).toBe("Order #A012 is ready for pickup 🎉");
  });
  it("tells delivery customers about the driver", () => {
    expect(alertText("ready", { ...o, fulfillment: "delivery" }).body).toMatch(/waiting for your driver/);
    expect(alertText("courier:picked_up", { ...o, fulfillment: "delivery" }).title).toBe("Order #A012 is on its way 🚗");
    expect(alertText("courier:failed", { ...o, fulfillment: "delivery" }).body).toMatch(/call you/);
  });
});
