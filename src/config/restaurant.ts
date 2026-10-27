// Per-client settings. In demo mode the CLI writes these into the demo database instead;
// in a live client repo this file is the source of truth. See docs/01-architecture.md.

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

export const restaurant: RestaurantConfig = {
  slug: "the-hood",
  name: "The Hood Bar & Pizza",
  shortName: "The Hood",
  tagline: "Dive bar · scratch pizza · live music",
  domain: "thehoodpalmdesert.com",
  timezone: "America/Los_Angeles",
  address: "74360 Hwy 111, Palm Desert, CA 92260",
  phone: "(760) 555-0134", // TBD — placeholder until the owner confirms
  location: { lat: 33.7222, lng: -116.3745 },
  theme: { primary: "#F5A524", primaryInk: "#18181b", header: "#18181b", bg: "#f5f5f4" },
  payments: { mode: "connect" },
  features: { voice: true, newsletter: true, events: true, scheduling: true, payroll: false, deposits: true },
  social: [
    { label: "Instagram", url: "https://instagram.com" },
    { label: "Facebook", url: "https://facebook.com" },
  ],
  links: { yelp: "https://www.yelp.com/biz/the-hood-bar-and-pizza-palm-desert" },
};

export const APP_MODE = (process.env.APP_MODE ?? "demo") as "demo" | "live";
export const isDemo = APP_MODE === "demo";
