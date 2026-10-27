import "server-only";
import { demoCourierStatus } from "@/domain/delivery";
import type { DeliveryProvider } from "./types";

// Pretend driver for pitches: a believable fee and ETA, and a trip that follows the kitchen
// (assigned → at the restaurant when the food is ready → on the way → delivered in ~3 minutes).
export const demoDelivery: DeliveryProvider = {
  name: "demo",
  label: "Demo driver",
  async quote(i) {
    // a fee that looks like a real one and varies a little by address
    const spread = [...i.dropoff.street].reduce((a, c) => a + c.charCodeAt(0), 0) % 300;
    return { feeCents: 599 + spread, etaMinutes: 35 + (spread % 15), quoteId: `demo_${i.ref}`, expiresAt: new Date(Date.now() + 30 * 60_000) };
  },
  async book(i) {
    return { id: i.quoteId, status: "requested", courierName: "Sam", dropoffEta: new Date(Date.now() + 35 * 60_000).toISOString() };
  },
  async status(rec, { readyAt }) {
    return { status: demoCourierStatus(new Date(rec.bookedAt), readyAt) };
  },
};
