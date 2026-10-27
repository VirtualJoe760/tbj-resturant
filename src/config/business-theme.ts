// THE place for this restaurant's look: logo, app icon, home page banner photos, fonts, colors.
// Put image files in public/brand/ and point to them here ("/brand/logo.png"). Every screen,
// the app icon at every size, the install manifest and the app-store builds read from this file.
//
// `create-tbj-restaurant` writes it (and copies the images) during intake; edit by hand any time.
// Owners can try changes in Admin → Branding; those sit on top of this file until reset.
import type { BusinessTheme } from "./types";

export const businessTheme: BusinessTheme = {
  // PNG with a see-through background; shown on the home page and the desktop top bar. null = name in text
  logo: null,

  // Square PNG, at least 1024 × 1024, important part in the middle (Android crops to a circle).
  // null = first letter of the name on the header color
  appIcon: null,

  // Wide photos (at least 1600 px across) that crossfade behind the home page header, in order
  heroBanners: [],

  // Whole look of the site: "classic" | "midnight" (dark) | "diner" (retro) | "minimal" (white, square)
  style: "classic",

  // Font ids from FONTS in src/domain/branding.ts, e.g. "oswald", "bebas", "playfair", "inter"
  fonts: { heading: "system", body: "system" },

  // Accent = buttons and highlights; header = top bars, home header, app background; background = page
  colors: { accent: "#F5A524", header: "#18181b", background: "#f5f5f4" },
};
