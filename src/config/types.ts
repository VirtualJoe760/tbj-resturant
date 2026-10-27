// Shape of a restaurant's settings. The values live in restaurant.ts, which
// `create-restaurant switch` regenerates for a new business.

export interface RestaurantConfig {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  domain: string; // used for the four test-account emails
  timezone: string;
  address: string;
  phone: string;
  location: { lat: number; lng: number };
  theme: { primary: string; primaryInk: string; header: string; bg: string };
  payments: { mode: "connect" | "direct" };
  features: { voice: boolean; newsletter: boolean; events: boolean; scheduling: boolean; payroll: false | "gusto"; deposits: boolean };
  social: { label: string; url: string }[];
  links: { yelp?: string; google?: string };
}

export const APP_MODE = (process.env.APP_MODE ?? "demo") as "demo" | "live";
export const isDemo = APP_MODE === "demo";
