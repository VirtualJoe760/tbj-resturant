import * as z from "zod/v4";

// The menu shape the app's importer reads (src/db/import-menu.ts). Prices in cents.
export const MenuSchema = z.object({
  categories: z.array(z.object({
    name: z.string(),
    items: z.array(z.object({
      name: z.string(),
      description: z.string(),
      price_cents: z.number().int(),
      orderable_online: z.boolean().describe("false for alcohol and anything dine-in only"),
      tags: z.array(z.string()),
      modifier_groups: z.array(z.object({
        name: z.string(),
        kind: z.enum(["choice", "addon", "removal", "option"]).describe("choice = pick one (size, sauce); addon = extra toppings; removal = ingredients it comes with that can be held"),
        min: z.number().int(),
        max: z.number().int(),
        options: z.array(z.object({ name: z.string(), price_cents: z.number().int(), is_default: z.boolean() })),
      })),
    })),
  })),
  guesses: z.array(z.string()).describe("Anything inferred rather than read, e.g. 'whole pie price estimated from slice price'"),
});
export type Menu = z.infer<typeof MenuSchema>;

export interface Photo {
  source: "google" | "yelp" | "website" | "upload";
  url: string;
  attribution?: string;
  owned: boolean; // false = third-party photo, demo only (docs/15-intake-and-demo.md)
  role?: "hero" | "item" | "gallery" | "event" | "skip";
  itemName?: string;
  tags?: string[];
}

export interface Intake {
  slug: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  location?: { lat: number; lng: number };
  hours?: { weekday: number; opensAt: string; closesAt: string }[];
  links: { google?: string; yelp?: string };
  theme?: { primary: string; header: string };
  cuisine?: string;
  menu?: Menu;
  photos: Photo[];
  features: Record<string, boolean>;
  sources: Record<string, string>; // field → where it came from (google / yelp / website / ai / manual / default)
  createdAt: string;
}
