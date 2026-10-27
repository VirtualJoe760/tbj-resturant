// The restaurant's look. src/config/business-theme.ts is the source of truth; Admin → Branding
// can layer owner changes on top (stored as overrides in brand.settings), each one resettable.
import type { BusinessTheme, GalleryPhoto, SiteStyle } from "../config/types";

export const STYLES: { id: SiteStyle; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Light pages, rounded cards" },
  { id: "midnight", label: "Midnight", hint: "Dark pages, glowing accent" },
  { id: "diner", label: "Diner", hint: "Cream paper, bold outlines, retro" },
  { id: "minimal", label: "Minimal", hint: "White space, square corners" },
];
const styleOf = (x: unknown): SiteStyle => (STYLES.some((s) => s.id === x) ? (x as SiteStyle) : "classic");

export interface Theme { primary: string; primaryInk: string; header: string; bg: string }

export interface Branding {
  style: SiteStyle;
  theme: Theme;
  headingFont: string; // id from FONTS
  bodyFont: string;
  logoUrl: string | null;
  iconUrl: string | null; // "/brand/app-icon.png" from the theme file, or "/media/<id>" uploaded in admin
  banners: string[]; // image URLs, shown as a slideshow behind the home page header
  gallery: GalleryPhoto[]; // the "Photos" strip on the home page
}

/** What Admin → Branding saves: only the fields the owner changed from business-theme.ts. */
export type BrandingOverrides = Partial<Omit<Branding, "theme">> & { theme?: Partial<Omit<Theme, "primaryInk">> };

export interface FontChoice { id: string; label: string; stack: string; google?: string }

// Google Fonts that read well on a phone. `google` is the css2 family spec.
export const FONTS: FontChoice[] = [
  { id: "system", label: "Phone default", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { id: "inter", label: "Inter", stack: '"Inter", system-ui, sans-serif', google: "Inter:wght@400;600;700;800" },
  { id: "dm-sans", label: "DM Sans", stack: '"DM Sans", system-ui, sans-serif', google: "DM+Sans:wght@400;600;700;800" },
  { id: "poppins", label: "Poppins", stack: '"Poppins", system-ui, sans-serif', google: "Poppins:wght@400;600;700;800" },
  { id: "montserrat", label: "Montserrat", stack: '"Montserrat", system-ui, sans-serif', google: "Montserrat:wght@400;600;700;800" },
  { id: "oswald", label: "Oswald (tall, bold)", stack: '"Oswald", Impact, sans-serif', google: "Oswald:wght@500;700" },
  { id: "bebas", label: "Bebas Neue (poster)", stack: '"Bebas Neue", Impact, sans-serif', google: "Bebas+Neue" },
  { id: "archivo-black", label: "Archivo Black (heavy)", stack: '"Archivo Black", Impact, sans-serif', google: "Archivo+Black" },
  { id: "playfair", label: "Playfair Display (elegant)", stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@600;800" },
  { id: "lora", label: "Lora (classic)", stack: '"Lora", Georgia, serif', google: "Lora:wght@400;600;700" },
  { id: "roboto-slab", label: "Roboto Slab (diner)", stack: '"Roboto Slab", Georgia, serif', google: "Roboto+Slab:wght@400;700;800" },
  { id: "permanent-marker", label: "Permanent Marker (hand-drawn)", stack: '"Permanent Marker", "Comic Sans MS", cursive', google: "Permanent+Marker" },
  { id: "pacifico", label: "Pacifico (script)", stack: '"Pacifico", cursive', google: "Pacifico" },
];

export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** One stylesheet link for the chosen fonts, or null when both use the phone default. */
export function googleFontsHref(ids: string[]) {
  const specs = [...new Set(ids)].map((id) => fontById(id).google).filter(Boolean);
  return specs.length ? `https://fonts.googleapis.com/css2?${specs.map((g) => `family=${g}`).join("&")}&display=swap` : null;
}

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (x: unknown): x is string => typeof x === "string" && HEX.test(x);

/** Black or white text, whichever reads better on the given color. */
export function inkFor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#18181b" : "#ffffff";
}

export function fromBusinessTheme(t: BusinessTheme): Branding {
  return {
    style: styleOf(t.style),
    theme: { primary: t.colors.accent, header: t.colors.header, bg: t.colors.background, primaryInk: inkFor(t.colors.accent) },
    headingFont: fontById(t.fonts.heading).id,
    bodyFont: fontById(t.fonts.body).id,
    logoUrl: t.logo,
    iconUrl: t.appIcon,
    banners: t.heroBanners,
    gallery: t.gallery ?? [],
  };
}

/** business-theme.ts with the owner's overrides applied; bad values fall back to the file. */
export function resolveBranding(overrides: BrandingOverrides | undefined, base: Branding): Branding {
  const o = overrides ?? {};
  const pickHex = (v: unknown, fallback: string) => (isHex(v) ? v : fallback);
  const theme: Theme = {
    primary: pickHex(o.theme?.primary, base.theme.primary),
    header: pickHex(o.theme?.header, base.theme.header),
    bg: pickHex(o.theme?.bg, base.theme.bg),
    primaryInk: "",
  };
  theme.primaryInk = inkFor(theme.primary);
  return {
    style: o.style ? styleOf(o.style) : base.style,
    theme,
    headingFont: o.headingFont && FONTS.some((f) => f.id === o.headingFont) ? o.headingFont : base.headingFont,
    bodyFont: o.bodyFont && FONTS.some((f) => f.id === o.bodyFont) ? o.bodyFont : base.bodyFont,
    logoUrl: o.logoUrl !== undefined ? o.logoUrl : base.logoUrl,
    iconUrl: o.iconUrl !== undefined ? o.iconUrl : base.iconUrl,
    banners: o.banners ?? base.banners,
    gallery: o.gallery ?? base.gallery,
  };
}

/** The fields of `b` that differ from the file: what gets stored as overrides. */
export function diffBranding(b: Branding, base: Branding): BrandingOverrides {
  const o: BrandingOverrides = {};
  const theme: NonNullable<BrandingOverrides["theme"]> = {};
  for (const k of ["primary", "header", "bg"] as const) if (b.theme[k].toLowerCase() !== base.theme[k].toLowerCase()) theme[k] = b.theme[k];
  if (Object.keys(theme).length) o.theme = theme;
  if (b.style !== base.style) o.style = b.style;
  if (b.headingFont !== base.headingFont) o.headingFont = b.headingFont;
  if (b.bodyFont !== base.bodyFont) o.bodyFont = b.bodyFont;
  if (b.logoUrl !== base.logoUrl) o.logoUrl = b.logoUrl;
  if (b.iconUrl !== base.iconUrl) o.iconUrl = b.iconUrl;
  if (JSON.stringify(b.banners) !== JSON.stringify(base.banners)) o.banners = b.banners;
  if (JSON.stringify(b.gallery) !== JSON.stringify(base.gallery)) o.gallery = b.gallery;
  return o;
}
