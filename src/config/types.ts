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
  payments: { mode: "connect" | "direct" };
  features: { voice: boolean; newsletter: boolean; events: boolean; scheduling: boolean; payroll: false | "gusto"; deposits: boolean };
  social: { label: string; url: string }[];
  links: { yelp?: string; google?: string };
  // App-store builds (docs/16-app-stores.md). Filled in once the client's store listings exist.
  app?: {
    androidPackage?: string; // e.g. "com.thehoodpalmdesert.app"
    androidSha256?: string[]; // signing-key fingerprints from Play Console → App integrity
    iosBundleId?: string; // e.g. "com.thehoodpalmdesert.app"
    iosAppId?: string; // "<Apple team id>.<bundle id>", for links that open the app
  };
}

// The restaurant's look; values live in business-theme.ts (one file, plus images in public/brand/).
export interface BusinessTheme {
  logo: string | null;
  appIcon: string | null;
  heroBanners: string[];
  fonts: { heading: string; body: string };
  colors: { accent: string; header: string; background: string };
}

export const APP_MODE = (process.env.APP_MODE ?? "demo") as "demo" | "live";
export const isDemo = APP_MODE === "demo";
