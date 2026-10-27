// Yelp's official API only (no page scraping — it breaks Yelp's terms). Paid after a trial.
import type { Photo } from "../types.ts";

export function yelpAlias(url: string) {
  const m = url.match(/yelp\.com\/biz\/([^/?#]+)/);
  return m?.[1];
}

export async function yelpDetails(key: string, url: string) {
  const alias = yelpAlias(url);
  if (!alias) throw new Error("That doesn't look like a Yelp business link (yelp.com/biz/...)");
  const r = await fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(alias)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Yelp ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const b = (await r.json()) as any;
  return {
    name: b.name as string,
    phone: b.display_phone as string | undefined,
    address: (b.location?.display_address ?? []).join(", ") as string,
    categories: (b.categories ?? []).map((c: any) => c.title) as string[],
    price: b.price as string | undefined,
    photos: (b.photos ?? []).map((u: string): Photo => ({ source: "yelp", url: u, attribution: "Yelp", owned: false })),
  };
}
