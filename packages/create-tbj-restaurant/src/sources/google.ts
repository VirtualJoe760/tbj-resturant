// Google Places API (New): text search → business details + photos. Official API, free monthly allowance.
import type { Photo } from "../types.ts";

const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber", "places.websiteUri",
  "places.location", "places.regularOpeningHours", "places.photos", "places.googleMapsUri", "places.primaryTypeDisplayName",
].join(",");

export interface GooglePlace {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  location?: { lat: number; lng: number };
  category?: string;
  hours?: { weekday: number; opensAt: string; closesAt: string }[];
  photos: Photo[];
}

export async function searchPlaces(key: string, query: string): Promise<GooglePlace[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  });
  if (!r.ok) throw new Error(`Google Places ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = (await r.json()) as { places?: any[] };
  return (data.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    mapsUrl: p.googleMapsUri,
    location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined,
    category: p.primaryTypeDisplayName?.text,
    hours: (p.regularOpeningHours?.periods ?? []).map((x: any) => ({
      weekday: x.open.day,
      opensAt: `${String(x.open.hour).padStart(2, "0")}:${String(x.open.minute ?? 0).padStart(2, "0")}`,
      closesAt: x.close ? `${String(x.close.hour).padStart(2, "0")}:${String(x.close.minute ?? 0).padStart(2, "0")}` : "23:59",
    })),
    // Shown through the Places photo endpoint with credit; not copied into our storage. The site
    // fetches them through /api/places-photo, so the key never goes in a file or a web page.
    photos: (p.photos ?? []).slice(0, 10).map((ph: any) => ({
      source: "google" as const,
      url: `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=1600`,
      ref: ph.name as string,
      attribution: ph.authorAttributions?.[0]?.displayName,
      owned: false,
    })),
  }));
}
