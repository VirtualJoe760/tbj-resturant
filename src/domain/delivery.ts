// Delivery without the marketplace commission: the order is placed on our site and a driver is
// booked from DoorDash Drive or Uber Direct (or a pretend driver on demo sites). This file is the
// shared vocabulary; the providers live in src/delivery/.

export interface DeliveryAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  instructions?: string; // "gate code 1234, leave at door"
}

export type CourierStatus =
  | "requested" // booked, looking for a driver
  | "assigned" // driver on the way to the restaurant
  | "at_pickup"
  | "picked_up" // on the way to the customer
  | "at_dropoff"
  | "delivered"
  | "cancelled"
  | "failed"; // couldn't book: the restaurant needs to call the customer

export interface DeliveryRecord {
  provider: "demo" | "doordash" | "uber";
  id: string; // the provider's delivery id (DoorDash: our external id)
  status: CourierStatus;
  trackingUrl?: string;
  courierName?: string;
  dropoffEta?: string; // ISO time
  bookedAt: string;
  checkedAt: string; // last time we asked the provider
  error?: string;
}

export const COURIER_LABEL: Record<CourierStatus, string> = {
  requested: "Finding a driver",
  assigned: "Driver heading to the restaurant",
  at_pickup: "Driver is at the restaurant",
  picked_up: "On the way to you",
  at_dropoff: "Driver is arriving",
  delivered: "Delivered",
  cancelled: "Delivery cancelled",
  failed: "Driver booking failed",
};

export const COURIER_DONE: CourierStatus[] = ["delivered", "cancelled", "failed"];

/** DoorDash Drive `delivery_status` → ours. */
export function fromDoorDash(status: string): CourierStatus {
  switch (status) {
    case "quote":
    case "created": return "requested";
    case "confirmed":
    case "enroute_to_pickup": return "assigned";
    case "arrived_at_pickup": return "at_pickup";
    case "picked_up":
    case "enroute_to_dropoff": return "picked_up";
    case "arrived_at_dropoff": return "at_dropoff";
    case "delivered": return "delivered";
    case "cancelled": return "cancelled";
    default: return "requested";
  }
}

/** Uber Direct delivery `status` (+ courier presence) → ours. */
export function fromUber(status: string, hasCourier = false): CourierStatus {
  switch (status) {
    case "pending": return hasCourier ? "assigned" : "requested";
    case "pickup": return "assigned";
    case "pickup_complete": return "picked_up";
    case "dropoff": return "picked_up";
    case "delivered": return "delivered";
    case "canceled":
    case "returned": return "cancelled";
    default: return "requested";
  }
}

/** "(760) 555-0134" → "+17605550134" (both services want E.164). US numbers only for now. */
export function e164(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return phone.startsWith("+") ? `+${d}` : `+${d}`;
}

export const formatAddress = (a: DeliveryAddress) => `${a.street}${a.unit ? ` ${a.unit}` : ""}, ${a.city}, ${a.state} ${a.zip}`;

/** Pulls "City, ST 12345" out of the restaurant's one-line address. */
export function parseOneLine(address: string): DeliveryAddress | null {
  const m = address.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
  return m ? { street: m[1].trim(), city: m[2].trim(), state: m[3], zip: m[4] } : null;
}

/**
 * The demo driver: status from the clock and the kitchen, so a pitch shows the whole trip.
 * Assigned 20 s after booking; at the restaurant once the food is ready; picked up 30 s later;
 * arriving after 2 min; delivered after 3 min.
 */
export function demoCourierStatus(bookedAt: Date, readyAt: Date | null, now = new Date()): CourierStatus {
  const s = (d: Date) => (now.getTime() - d.getTime()) / 1000;
  if (!readyAt) return s(bookedAt) >= 20 ? "assigned" : "requested";
  const since = s(readyAt);
  if (since < 30) return "at_pickup";
  if (since < 150) return "picked_up";
  if (since < 210) return "at_dropoff";
  return "delivered";
}
