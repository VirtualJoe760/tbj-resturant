import "server-only";
import { isDemo, restaurant } from "@/config/restaurant";
import type { DeliveryRecord } from "@/domain/delivery";
import type { DeliveryProvider } from "./types";
import { demoDelivery } from "./demo";
import { doordash, doordashReady } from "./doordash";
import { uber, uberReady } from "./uber";

// Code talks to this interface; which service drives comes from restaurant.delivery.provider and
// whether its keys are set (docs/17-delivery-and-order-alerts.md). Same idea as src/payments.

export type { Booked, BookInput, DeliveryProvider, Pickup, ProviderQuote, QuoteInput } from "./types";
export { DeliveryError } from "./types";

/** The configured service when its keys are set; the demo driver on demo sites; otherwise none. */
export function getDeliveryProvider(): DeliveryProvider | null {
  const d = restaurant.delivery;
  if (!d?.enabled) return null;
  if (d.provider === "doordash" && doordashReady()) return doordash;
  if (d.provider === "uber" && uberReady()) return uber;
  return isDemo ? demoDelivery : null;
}

export function providerByName(name: DeliveryRecord["provider"]): DeliveryProvider {
  return name === "doordash" ? doordash : name === "uber" ? uber : demoDelivery;
}
