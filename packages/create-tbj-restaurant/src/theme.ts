// The restaurant's look: asked during intake, saved in clients/<slug>/brand/, and written into the
// app as src/config/business-theme.ts + public/brand/ (the one place the site reads it from).
import fs from "node:fs";
import path from "node:path";
import type { Intake, IntakeBranding, Photo } from "./types.ts";

// Same ids as STYLES in src/domain/branding.ts: the whole look of the site.
export const STYLE_CHOICES: [id: NonNullable<IntakeBranding["style"]>, label: string, hint: string][] = [
  ["classic", "Classic", "light pages, rounded cards"],
  ["midnight", "Midnight", "dark pages, glowing accent: bars, late-night, moody brands"],
  ["diner", "Diner", "cream paper, bold outlines, retro"],
  ["minimal", "Minimal", "white space, square corners: cafés, bakeries, upscale"],
];

// Same ids as FONTS in src/domain/branding.ts (a test in the app keeps them in sync).
export const FONT_CHOICES: [id: string, label: string][] = [
  ["system", "Phone default"], ["inter", "Inter"], ["dm-sans", "DM Sans"], ["poppins", "Poppins"], ["montserrat", "Montserrat"],
  ["oswald", "Oswald (tall, bold)"], ["bebas", "Bebas Neue (poster)"], ["archivo-black", "Archivo Black (heavy)"],
  ["playfair", "Playfair Display (elegant)"], ["lora", "Lora (classic)"], ["roboto-slab", "Roboto Slab (diner)"],
  ["permanent-marker", "Permanent Marker (hand-drawn)"], ["pacifico", "Pacifico (script)"],
];

const IMAGE = /\.(png|jpe?g|webp)$/i;
const MAX_BYTES = 3 * 1024 * 1024;

/** Problem with an image file the owner gave us, or null when it's usable. */
export function checkImage(file: string) {
  if (!fs.existsSync(file)) return "File not found";
  if (!IMAGE.test(file)) return "Use a PNG, JPG or WebP";
  if (fs.statSync(file).size > MAX_BYTES) return "Over 3 MB — export a smaller copy";
  return null;
}

/**
 * Puts the logo, app icon and photos in clients/<slug>/brand/ and records them relative to that
 * folder. Each source is a file on this computer or an https link (e.g. the logo on their website).
 */
export async function collectBrandFiles(clientDir: string, b: { logo?: string; icon?: string; banners?: string[] }): Promise<Partial<IntakeBranding>> {
  const brandDir = path.join(clientDir, "brand");
  fs.mkdirSync(brandDir, { recursive: true });
  const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
  const place = async (src: string, name: string) => {
    if (/^https?:\/\//.test(src)) {
      try {
        const r = await fetch(src, { headers: { "user-agent": "Mozilla/5.0 (restaurant-intake)" } });
        const type = (r.headers.get("content-type") ?? "").split(";")[0];
        const buf = Buffer.from(await r.arrayBuffer());
        if (!r.ok || !EXT[type] || buf.length > MAX_BYTES) return undefined;
        fs.writeFileSync(path.join(brandDir, name + EXT[type]), buf);
        return `brand/${name}${EXT[type]}`;
      } catch {
        return undefined;
      }
    }
    const dest = `${name}${path.extname(src).toLowerCase().replace(".jpeg", ".jpg")}`;
    fs.copyFileSync(src, path.join(brandDir, dest));
    return `brand/${dest}`;
  };
  const logoFile = b.logo ? await place(b.logo, "logo") : undefined;
  const iconFile = b.icon ? await place(b.icon, "app-icon") : undefined;
  const bannerFiles = (await Promise.all((b.banners ?? []).map((f, i) => place(f, `hero-${i + 1}`)))).filter((x): x is string => !!x);
  return { ...(logoFile ? { logoFile } : {}), ...(iconFile ? { iconFile } : {}), ...(bannerFiles.length ? { bannerFiles } : {}) };
}

/** Where the site loads a listing photo from. Google photos go through the site's own server so
 * the API key never reaches a page; anything carrying a key is refused. */
export function photoSrc(p: Photo) {
  const u = p.source === "google" && p.ref ? `/api/places-photo?name=${p.ref}` : p.url;
  return u.startsWith("/") || (u.startsWith("https://") && !/[?&]key=/i.test(u)) ? u : undefined;
}

const usable = (p: Photo) => p.role !== "skip" && p.role !== "menu" && !!photoSrc(p);

/** Listing photos for the home page slideshow: the AI-picked hero first, then the room and food. */
export function pickBanners(photos: Photo[], max = 5) {
  const rank = (p: Photo) => (p.role === "hero" ? 0 : p.tags?.includes("interior") ? 1 : p.role === "gallery" ? 2 : p.role === "item" ? 3 : 4);
  return photos.filter(usable).sort((a, b) => rank(a) - rank(b)).slice(0, max).map((p) => photoSrc(p)!);
}

/** The photo gallery on the home page: everything worth showing that isn't a banner, with credit. */
export function pickGallery(photos: Photo[], banners: string[], max = 12) {
  return photos.filter((p) => usable(p) && !banners.includes(photoSrc(p)!) && (p.quality ?? 6) >= 5).slice(0, max)
    .map((p) => ({ src: photoSrc(p)!, credit: p.source === "google" ? `${p.attribution ?? "Google"} · Google` : p.source === "yelp" ? "Yelp" : undefined, alt: p.dish }));
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "with", "pizza", "slice"].includes(w));

/**
 * Matches food photos to menu items: the item Claude named, else the item whose name shares the
 * most words with the photo's dish ("pepperoni pizza with hot honey" → "Pepperoni & Hot Honey").
 */
export function matchDishes(photos: Photo[], itemNames: string[]): Photo[] {
  return photos.map((p) => {
    if (p.role !== "item" && p.role !== "hero" && p.role !== "gallery") return p;
    const named = p.itemName && itemNames.find((n) => n.toLowerCase() === p.itemName!.toLowerCase());
    if (named) return { ...p, itemName: named };
    if (!p.dish) return { ...p, itemName: undefined };
    const dish = new Set(words(p.dish));
    let best: { name: string; score: number } | null = null;
    for (const name of itemNames) {
      const w = words(name);
      if (!w.length) continue;
      const score = w.filter((x) => dish.has(x)).length / w.length;
      if (score > (best?.score ?? 0)) best = { name, score };
    }
    return { ...p, itemName: best && best.score >= 0.5 ? best.name : undefined };
  });
}

const q = (s: string | null) => JSON.stringify(s);

/**
 * Copies clients/<slug>/brand/* into public/brand/ (replacing the previous business's files) and
 * returns the source of src/config/business-theme.ts pointing at them.
 */
export function installTheme(intake: Intake, clientDir: string, appRoot: string) {
  const b = intake.branding ?? {};
  const pub = path.join(appRoot, "public", "brand");
  fs.rmSync(pub, { recursive: true, force: true });
  fs.mkdirSync(pub, { recursive: true });
  const place = (rel?: string) => {
    if (!rel || !fs.existsSync(path.join(clientDir, rel))) return null;
    fs.copyFileSync(path.join(clientDir, rel), path.join(pub, path.basename(rel)));
    return `/brand/${path.basename(rel)}`;
  };
  const logo = place(b.logoFile);
  const icon = place(b.iconFile);
  const files = (b.bannerFiles ?? []).map(place).filter((x): x is string => !!x);
  const banners = files.length ? files : b.banners ?? [];
  const gallery = b.gallery ?? [];
  const accent = b.colors?.accent ?? intake.theme?.primary ?? "#F5A524";
  const header = b.colors?.header ?? intake.theme?.header ?? "#18181b";
  const background = b.colors?.background ?? "#f5f5f4";
  const fonts = b.fonts ?? { heading: "system", body: "system" };

  return `// THE place for this restaurant's look: logo, app icon, home page banner photos, fonts, colors.
// Put image files in public/brand/ and point to them here ("/brand/logo.png"). Every screen,
// the app icon at every size, the install manifest and the app-store builds read from this file.
//
// \`create-tbj-restaurant\` writes it (and copies the images) during intake; edit by hand any time.
// Owners can try changes in Admin → Branding; those sit on top of this file until reset.
import type { BusinessTheme } from "./types";

export const businessTheme: BusinessTheme = {
  // PNG with a see-through background; shown on the home page and the desktop top bar. null = name in text
  logo: ${q(logo)},

  // Square PNG, at least 1024 × 1024, important part in the middle (Android crops to a circle).
  // null = first letter of the name on the header color
  appIcon: ${q(icon)},

  // Wide photos (at least 1600 px across) that crossfade behind the home page header, in order${files.length ? "" : banners.length ? "\n  // (listing photos for the demo: replace with the owner's own before launch)" : ""}
  heroBanners: [${banners.map((u) => `\n    ${q(u)},`).join("")}${banners.length ? "\n  " : ""}],

  // More photos for the "Photos" strip on the home page (credit is shown under listing photos)
  gallery: [${gallery.map((g) => `\n    { src: ${q(g.src)}${g.credit ? `, credit: ${q(g.credit)}` : ""}${g.alt ? `, alt: ${q(g.alt)}` : ""} },`).join("")}${gallery.length ? "\n  " : ""}],

  // Whole look of the site: "classic" | "midnight" (dark) | "diner" (retro) | "minimal" (white, square)
  style: ${q(b.style ?? "classic")},

  // Font ids from FONTS in src/domain/branding.ts, e.g. "oswald", "bebas", "playfair", "inter"
  fonts: { heading: ${q(fonts.heading)}, body: ${q(fonts.body)} },

  // Accent = buttons and highlights; header = top bars, home header, app background; background = page
  colors: { accent: ${q(accent)}, header: ${q(header)}, background: ${q(background)} },
};
`;
}
