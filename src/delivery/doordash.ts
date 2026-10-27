import "server-only";
import { createHmac } from "node:crypto";
import { e164, formatAddress, fromDoorDash } from "@/domain/delivery";
import { DeliveryError, type DeliveryProvider, type QuoteInput } from "./types";

// DoorDash Drive (on-demand delivery API): quote → accept the quote → poll the delivery.
// Keys from the DoorDash Developer Portal → Credentials (env vars, never in the repo).
const API = "https://openapi.doordash.com/drive/v2";
const env = () => ({ developerId: process.env.DOORDASH_DEVELOPER_ID, keyId: process.env.DOORDASH_KEY_ID, secret: process.env.DOORDASH_SIGNING_SECRET });

export const doordashReady = () => Object.values(env()).every(Boolean);

/** Drive's auth: a 5-minute JWT signed with the signing secret (DD-JWT-V1). */
export function doordashToken(now = Math.floor(Date.now() / 1000)) {
  const { developerId, keyId, secret } = env();
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${b64({ alg: "HS256", typ: "JWT", "dd-ver": "DD-JWT-V1" })}.${b64({ aud: "doordash", iss: developerId, kid: keyId, exp: now + 300, iat: now })}`;
  return `${data}.${createHmac("sha256", Buffer.from(secret!, "base64url")).update(data).digest("base64url")}`;
}

async function call<T>(method: string, path: string, body?: object): Promise<T> {
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${doordashToken()}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new DeliveryError(json.message ?? json.field_errors?.[0]?.error ?? `DoorDash said ${r.status}`);
  return json as T;
}

interface DdDelivery { external_delivery_id: string; delivery_status: string; fee: number; tracking_url?: string; dasher_name?: string; dropoff_time_estimated?: string }

const body = (i: QuoteInput) => ({
  external_delivery_id: i.ref,
  pickup_address: formatAddress(i.pickup.address),
  pickup_business_name: i.pickup.name,
  pickup_phone_number: e164(i.pickup.phone),
  dropoff_address: formatAddress(i.dropoff),
  dropoff_phone_number: e164(i.customerPhone),
  dropoff_contact_given_name: i.customerName.split(" ")[0],
  dropoff_contact_family_name: i.customerName.split(" ").slice(1).join(" ") || undefined,
  dropoff_instructions: i.dropoff.instructions || undefined,
  order_value: i.subtotalCents,
});

const minutesUntil = (iso?: string) => (iso ? Math.max(10, Math.round((new Date(iso).getTime() - Date.now()) / 60_000)) : 40);

export const doordash: DeliveryProvider = {
  name: "doordash",
  label: "DoorDash",
  async quote(i) {
    const q = await call<DdDelivery>("POST", "/quotes", body(i));
    return { feeCents: q.fee, etaMinutes: minutesUntil(q.dropoff_time_estimated), quoteId: q.external_delivery_id, expiresAt: new Date(Date.now() + 5 * 60_000) };
  },
  async book(i) {
    let d: DdDelivery;
    try {
      d = await call<DdDelivery>("POST", `/quotes/${encodeURIComponent(i.quoteId)}/accept`, { tip: i.tipCents });
    } catch {
      // quotes last 5 minutes; a slow card payment means booking fresh with a new id
      d = await call<DdDelivery>("POST", "/deliveries", { ...body({ ...i, ref: `${i.ref}-b` }), tip: i.tipCents });
    }
    return { id: d.external_delivery_id, status: fromDoorDash(d.delivery_status), trackingUrl: d.tracking_url, courierName: d.dasher_name, dropoffEta: d.dropoff_time_estimated };
  },
  async status(rec) {
    const d = await call<DdDelivery>("GET", `/deliveries/${encodeURIComponent(rec.id)}`);
    return { status: fromDoorDash(d.delivery_status), trackingUrl: d.tracking_url, courierName: d.dasher_name, dropoffEta: d.dropoff_time_estimated };
  },
};
