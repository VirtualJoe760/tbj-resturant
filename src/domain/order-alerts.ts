// What we tell a customer as their order moves: shown on their dashboard, as a pop-up while the
// site is open, and as a phone notification when they turned those on.
import type { CourierStatus } from "./delivery";

export type OrderAlert = "started" | "ready" | `courier:${CourierStatus}`;

export function alertText(alert: OrderAlert, o: { number: string; fulfillment: "pickup" | "delivery"; place: string }): { title: string; body: string } {
  const n = `#${o.number}`;
  switch (alert) {
    case "started":
      return { title: `We started your order ${n}`, body: o.fulfillment === "delivery" ? `${o.place} is making it now. We'll tell you when a driver picks it up.` : `${o.place} is making it now. We'll tell you when it's ready.` };
    case "ready":
      return o.fulfillment === "delivery"
        ? { title: `Order ${n} is ready`, body: "It's packed and waiting for your driver." }
        : { title: `Order ${n} is ready for pickup 🎉`, body: `Come grab it at ${o.place}.` };
    case "courier:assigned":
      return { title: `A driver is on the way to ${o.place}`, body: `They'll pick up order ${n} when it's ready.` };
    case "courier:picked_up":
      return { title: `Order ${n} is on its way 🚗`, body: "Your driver just picked it up." };
    case "courier:at_dropoff":
      return { title: "Your driver is arriving", body: `Order ${n} is almost there.` };
    case "courier:delivered":
      return { title: `Order ${n} was delivered`, body: "Enjoy! Thanks for ordering direct." };
    case "courier:cancelled":
    case "courier:failed":
      return { title: `Problem with the delivery of ${n}`, body: `${o.place} will call you to sort it out.` };
    default:
      return { title: `Update on order ${n}`, body: "" };
  }
}

/** Courier changes worth interrupting someone for (the rest just update the page). */
export const ALERT_COURIER: CourierStatus[] = ["assigned", "picked_up", "at_dropoff", "delivered", "cancelled", "failed"];
