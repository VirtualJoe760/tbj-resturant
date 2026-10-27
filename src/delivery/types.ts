// Shapes shared by the delivery services (kept apart from provider.ts to avoid import cycles).
import type { DeliveryAddress, DeliveryRecord } from "@/domain/delivery";

export interface Pickup { name: string; phone: string; address: DeliveryAddress }

export interface QuoteInput {
  ref: string; // unique per attempt; DoorDash uses it as the delivery id
  pickup: Pickup;
  dropoff: DeliveryAddress;
  customerName: string;
  customerPhone: string;
  subtotalCents: number;
}

export interface ProviderQuote {
  feeCents: number; // what the service charges the restaurant
  etaMinutes: number;
  quoteId: string; // pass back to book()
  expiresAt: Date;
}

export interface BookInput extends QuoteInput {
  quoteId: string;
  orderNumber: string;
  tipCents: number; // goes to the driver
  items: { name: string; quantity: number }[];
}

export type Booked = Pick<DeliveryRecord, "id" | "status" | "trackingUrl" | "courierName" | "dropoffEta">;

export interface DeliveryProvider {
  name: DeliveryRecord["provider"];
  label: string;
  quote(i: QuoteInput): Promise<ProviderQuote>;
  book(i: BookInput): Promise<Booked>;
  /** Latest state from the service. `readyAt` lets the demo driver follow the kitchen. */
  status(rec: DeliveryRecord, ctx: { readyAt: Date | null }): Promise<Partial<Booked>>;
}

/** A service error worded so a customer can read it. */
export class DeliveryError extends Error {}
