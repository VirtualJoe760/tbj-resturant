import "server-only";
import { e164, fromUber, type DeliveryAddress } from "@/domain/delivery";
import { DeliveryError, type DeliveryProvider } from "./types";

// Uber Direct (Uber's delivery-as-a-service API): quote → create delivery with the quote → poll.
// Keys from direct.uber.com → Developer (env vars, never in the repo).
const env = () => ({ customerId: process.env.UBER_CUSTOMER_ID, clientId: process.env.UBER_CLIENT_ID, secret: process.env.UBER_CLIENT_SECRET });
export const uberReady = () => Object.values(env()).every(Boolean);

let token: { value: string; until: number } | null = null;
async function accessToken() {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const { clientId, secret } = env();
  const r = await fetch("https://auth.uber.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId!, client_secret: secret!, grant_type: "client_credentials", scope: "eats.deliveries" }),
  });
  const j = await r.json();
  if (!r.ok) throw new DeliveryError("Uber sign-in failed: check the Uber Direct keys");
  token = { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function call<T>(method: string, path: string, body?: object): Promise<T> {
  const r = await fetch(`https://api.uber.com/v1/customers/${env().customerId}${path}`, {
    method, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new DeliveryError(json.message ?? `Uber said ${r.status}`);
  return json as T;
}

/** Uber takes addresses as a JSON string of the structured parts. */
export const uberAddress = (a: DeliveryAddress) =>
  JSON.stringify({ street_address: [a.street, ...(a.unit ? [a.unit] : [])], city: a.city, state: a.state, zip_code: a.zip, country: "US" });

interface UberQuote { id: string; fee: number; dropoff_eta?: string; duration?: number; expires?: string }
interface UberDelivery { id: string; status: string; tracking_url?: string; courier?: { name?: string } | null; dropoff_eta?: string }

export const uber: DeliveryProvider = {
  name: "uber",
  label: "Uber",
  async quote(i) {
    const q = await call<UberQuote>("POST", "/delivery_quotes", {
      pickup_address: uberAddress(i.pickup.address), dropoff_address: uberAddress(i.dropoff),
      pickup_phone_number: e164(i.pickup.phone), dropoff_phone_number: e164(i.customerPhone), manifest_total_value: i.subtotalCents, external_id: i.ref,
    });
    return { feeCents: q.fee, etaMinutes: q.duration ?? 40, quoteId: q.id, expiresAt: q.expires ? new Date(q.expires) : new Date(Date.now() + 15 * 60_000) };
  },
  async book(i) {
    const base = {
      pickup_name: i.pickup.name, pickup_address: uberAddress(i.pickup.address), pickup_phone_number: e164(i.pickup.phone),
      dropoff_name: i.customerName, dropoff_address: uberAddress(i.dropoff), dropoff_phone_number: e164(i.customerPhone), dropoff_notes: i.dropoff.instructions,
      manifest_items: i.items.map((x) => ({ name: x.name, quantity: x.quantity, size: "small" })), manifest_reference: `#${i.orderNumber}`,
      manifest_total_value: i.subtotalCents, external_id: i.ref, tip: i.tipCents,
    };
    let d: UberDelivery;
    try {
      d = await call<UberDelivery>("POST", "/deliveries", { ...base, quote_id: i.quoteId });
    } catch {
      d = await call<UberDelivery>("POST", "/deliveries", base); // quote expired: book at the current price
    }
    return { id: d.id, status: fromUber(d.status, !!d.courier), trackingUrl: d.tracking_url, courierName: d.courier?.name, dropoffEta: d.dropoff_eta };
  },
  async status(rec) {
    const d = await call<UberDelivery>("GET", `/deliveries/${encodeURIComponent(rec.id)}`);
    return { status: fromUber(d.status, !!d.courier), trackingUrl: d.tracking_url, courierName: d.courier?.name, dropoffEta: d.dropoff_eta };
  },
};
