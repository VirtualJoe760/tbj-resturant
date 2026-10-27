// create-tbj-resturant: questionnaire → client files (menu, menu times, logo, app icon, photos,
// fonts, colors, delivery) → a restaurant app → (optional) demo deploy → app-store kit.
// Usage:
//   npx create-tbj-resturant [folder] [flags]   a NEW restaurant app in ./folder (same flags as switch)
//   create-tbj-restaurant login                 store our API keys (hidden prompts)
//   create-tbj-restaurant new [--answers a.json] questionnaire (or answers file for scripted runs)
//   create-tbj-restaurant list                  intakes on this machine
//   create-tbj-restaurant switch [--google "John's Diner, Indio, CA" | --yelp <url> | --website <url>]
//                                [--logo f.png] [--icon f.png] [--photos a.jpg,b.jpg]
//                                [--delivery doordash|uber|none] [--delivery-fee quote|2.99] [--delivery-min 15] [--deploy]
//                                               point this repo's demo site at a different business
//   create-tbj-restaurant store [--url https://…] Play Store + App Store kit in ./store
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import { getKey, KEYS, keyStatus, saveKeys, type KeyName } from "./credentials.ts";
import { parseGoogleLink, searchPlaces } from "./sources/google.ts";
import { yelpAlias, yelpDetails } from "./sources/yelp.ts";
import { readWebsite } from "./sources/website.ts";
import { readMenu, sortPhotos } from "./sources/ai.ts";
import { parsePlainMenu } from "./sources/manual-menu.ts";
import { writeClient } from "./write.ts";
import { applyToApp, domainFor, findAppRoot, timezoneFor } from "./apply.ts";
import { checkImage, collectBrandFiles, FONT_CHOICES, pickBanners } from "./theme.ts";
import { guessMenuTimes, parseRange, PRESETS } from "./menu-times.ts";
import { packageIdFor, writeStoreKit } from "./store.ts";
import type { DeliverySettings, Intake, Menu, MenuTime, Photo } from "./types.ts";
import { copyTemplate, finishProject, folderName, nextSteps, startInstall, TEMPLATE } from "./create.ts";

const ROOT = process.env.CR_OUT ?? path.resolve(process.cwd(), "clients");
const cancel = <T>(v: T | symbol): T => {
  if (p.isCancel(v)) {
    p.cancel("Stopped — nothing was written.");
    process.exit(0);
  }
  return v as T;
};
const slugify = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function login() {
  p.intro("Store API keys for create-tbj-restaurant");
  const status = keyStatus();
  const values: Partial<Record<KeyName, string>> = {};
  for (const k of Object.keys(KEYS) as KeyName[]) {
    const v = cancel(await p.password({ message: `${KEYS[k]}${status[k] ? " (saved — Enter to keep)" : " (Enter to skip)"}`, mask: "•" }));
    if (v) values[k] = v.trim();
  }
  const file = saveKeys(values);
  p.outro(`Saved to ${file} (only your user account can read it).`);
}

interface Answers {
  name: string;
  city: string;
  google?: boolean | string;
  yelp?: string;
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
  menuText?: string;
  menuFiles?: string[];
  cuisine?: string;
  features?: Record<string, boolean>;
  // the look → business-theme.ts
  logo?: string; // file path
  icon?: string;
  photos?: string[]; // the owner's own banner photos
  accent?: string;
  header?: string;
  headingFont?: string;
  bodyFont?: string;
  menuTimes?: MenuTime[];
  androidPackage?: string;
  // delivery: "doordash" | "uber" | "none"; fee "quote" or dollars; minimum in dollars
  delivery?: string;
  deliveryFee?: string;
  deliveryMin?: string;
}

interface SwitchOptions {
  root: string;
  deploy: boolean;
  local: boolean;
  creating?: boolean; // a brand-new app: no deploy question, caller prints the next steps
  beforeApply?: () => Promise<void>; // e.g. wait for the background install
}

async function newRestaurant(scripted: Answers | null, switching?: SwitchOptions) {
  const ask = async <T>(key: keyof Answers, q: () => Promise<T | symbol>): Promise<T> => (scripted ? (scripted[key] as T) : cancel(await q()));
  const clean = (v?: string | null) => v?.trim().replace(/^"|"$/g, "") || undefined;
  /** An optional question: Enter skips it. */
  const optional = async (key: keyof Answers, message: string, opts: { placeholder?: string; initialValue?: string; validate?: (v: string) => string | undefined } = {}) =>
    clean(await ask<string>(key, () => p.text({ message, placeholder: opts.placeholder ?? "Enter to skip", initialValue: opts.initialValue, validate: (v) => (v && opts.validate ? opts.validate(v) : undefined) })));
  /** Asks for a missing API key in a hidden prompt and saves it for next time. Enter skips. */
  const askKey = async (k: KeyName, why: string) => {
    if (scripted) return undefined;
    p.log.info(why);
    const v = clean(String(cancel(await p.password({ message: `${KEYS[k]} (hidden; saved for next time; Enter to skip)`, mask: "•" })) ?? ""));
    if (v) saveKeys({ [k]: v });
    return v;
  };
  for (const k of ["ANTHROPIC_API_KEY"] as KeyName[]) if (!process.env[k] && getKey(k)) process.env[k] = getKey(k);

  if (!switching?.creating) p.intro(switching ? "Switch the demo site to a new business" : "New restaurant demo");
  if (!scripted) p.log.info("Paste what you have and press Enter to skip the rest. Everything else is pulled from Google, Yelp and their website.");
  const intake: Intake = { slug: "", name: scripted?.name ?? "", city: scripted?.city ?? "", timezone: "America/Los_Angeles", links: {}, photos: [], features: {}, sources: {}, createdAt: new Date().toISOString() };
  const spin = p.spinner();

  // 1. Where to look: their Google Business listing and Yelp page
  const googleAns = await ask<string | boolean>("google", () => p.text({ message: "Google Business link? (in Google Maps: Share → Copy link)", placeholder: "Enter to skip" }));
  const googleLink = typeof googleAns === "string" ? clean(googleAns) : undefined;
  const yelpLink = clean(await ask<string>("yelp", () => p.text({ message: "Yelp link?", placeholder: "Enter to skip", validate: (v) => (!v || yelpAlias(v) ? undefined : "A yelp.com/biz/… link") })));

  // 2. Google: address, phone, hours, website, photos
  let gKey = getKey("GOOGLE_PLACES_API_KEY");
  if ((googleLink || googleAns === true) && !gKey)
    gKey = await askKey("GOOGLE_PLACES_API_KEY", "A Google Places key lets this pull the address, phone, hours, website and photos from Google (free at this volume: console.cloud.google.com → enable \"Places API (New)\" → Credentials → API key).");
  if (googleLink) intake.links.google = googleLink;
  if ((googleLink || googleAns === true) && gKey) {
    spin.start("Looking them up on Google");
    try {
      const link = googleLink ? await parseGoogleLink(googleLink) : null;
      const query = [link?.name ?? intake.name, link?.name ? "" : intake.city].filter(Boolean).join(" ");
      const places = query ? await searchPlaces(gKey, query, link?.lat ? { lat: link.lat, lng: link.lng! } : undefined) : [];
      spin.stop(places.length ? `Google: found ${places[0].name}` : "Google: no match from that link");
      const idx = places.length <= 1 || scripted || link?.lat ? 0 : cancel(await p.select({ message: "Which one?", options: [...places.map((x, i) => ({ value: i, label: x.name, hint: x.address })), { value: -1, label: "None of these" }] }));
      const pick = idx === -1 ? undefined : places[idx];
      if (pick) {
        Object.assign(intake, { address: pick.address, phone: pick.phone, website: pick.website, location: pick.location, hours: pick.hours?.length ? pick.hours : undefined, cuisine: pick.category });
        intake.name ||= pick.name;
        intake.links.google = pick.mapsUrl ?? googleLink;
        intake.photos.push(...pick.photos);
        for (const f of ["name", "address", "phone", "website", "location", "hours"]) if ((intake as never)[f]) intake.sources[f] = "google";
      }
    } catch (e) {
      spin.stop(`Google lookup failed: ${(e as Error).message}`, 1);
    }
  }

  // 3. Yelp: photos and details (the link alone still goes in the footer)
  let yelpMenuUrl: string | undefined;
  if (yelpLink) {
    intake.links.yelp = yelpLink;
    let yKey = getKey("YELP_API_KEY");
    if (!yKey) yKey = await askKey("YELP_API_KEY", "A Yelp API key adds Yelp photos and details (Yelp charges after a free trial; skipping is fine).");
    if (yKey) {
      spin.start("Reading Yelp");
      try {
        const y = await yelpDetails(yKey, yelpLink);
        intake.photos.push(...y.photos);
        intake.name ||= y.name;
        intake.address ??= y.address;
        intake.phone ??= y.phone;
        intake.cuisine ??= y.categories[0];
        intake.website ??= y.website;
        yelpMenuUrl = y.menuUrl;
        spin.stop(`Yelp: ${y.photos.length} photos, ${y.categories.join(", ")}`);
      } catch (e) {
        spin.stop((e as Error).message, 1);
      }
    }
  }

  // 4. Their website: menu, logo, app icon, colors, photos, email
  const website = intake.website ?? (await optional("website", "Website?"));
  let siteMenu: { text: string; pdf?: string } | undefined;
  let found: { logo?: string; icon?: string } = {};
  if (website) {
    spin.start("Reading their website");
    try {
      const w = await readWebsite(website);
      intake.website = w.url;
      intake.email ??= w.email;
      if (w.themeColor && /^#[0-9a-f]{6}$/i.test(w.themeColor)) intake.theme = { primary: w.themeColor, header: "#18181b" };
      intake.photos.push(...w.photos);
      found = { logo: w.logoUrl, icon: w.iconUrl };
      if (w.hasMenu) siteMenu = { text: w.text, pdf: w.menuPdfs[0] };
      spin.stop(`Website: ${w.hasMenu ? "menu found" : "no menu found"}${w.logoUrl ? ", logo" : ""}${w.iconUrl ? ", app icon" : ""}, ${w.photos.length} images`);
    } catch (e) {
      spin.stop(`Couldn't read the website: ${(e as Error).message}`, 1);
    }
  }
  if (!siteMenu && yelpMenuUrl) {
    try {
      const m = yelpMenuUrl.toLowerCase().endsWith(".pdf") ? { text: "", pdf: yelpMenuUrl } : await readWebsite(yelpMenuUrl).then((w) => (w.hasMenu ? { text: w.text, pdf: w.menuPdfs[0] } : undefined));
      siteMenu = m;
    } catch {}
  }

  // 5. Basics still missing (only these are asked)
  if (!intake.name) intake.name = String(cancel(await p.text({ message: "Restaurant name?", validate: (v) => (v ? undefined : "Required") })));
  intake.slug = slugify(intake.name);
  intake.sources.name ??= "manual";
  intake.city ||= intake.address?.split(",").slice(-2).join(",").replace(/\d{5}(-\d{4})?/, "").trim() || (await optional("city", "City?", { placeholder: "Palm Desert, CA" })) || "";
  intake.address ??= await optional("address", "Address? (needed for delivery and directions)");
  intake.phone ??= await optional("phone", "Phone?");
  intake.email ??= await optional("email", "Owner email?", { validate: (v) => (v.includes("@") ? undefined : "Needs an email") });
  for (const f of ["address", "phone", "email"]) if ((intake as never)[f]) intake.sources[f] ??= "manual";

  // 6. Menu: from their website (or Yelp's menu link) when there is one, otherwise a PDF, photos or text
  let menu: Menu | undefined;
  let menuText = scripted?.menuText ?? "";
  const menuFiles = scripted?.menuFiles ?? [];
  let menuUrls: string[] = [];
  const menuFromSite = !menuText && !menuFiles.length && !!siteMenu;
  if (menuFromSite) {
    menuText = siteMenu!.text;
    if (siteMenu!.pdf) menuUrls = [siteMenu!.pdf];
    if (!scripted) p.log.success(`Using the menu from ${intake.website ?? "Yelp"}.`);
  } else if (!scripted) {
    const src = cancel(await p.select({
      message: website ? "No menu found online. Add one?" : "Add the menu?",
      options: [
        { value: "files", label: "PDF or photos on this computer" },
        { value: "paste", label: "Paste the menu text" },
        { value: "skip", label: "Skip (add it later in Admin → Menu)" },
      ],
    }));
    if (src === "files") menuFiles.push(...String(cancel(await p.text({ message: "File paths (comma separated)" }))).split(",").map((s) => clean(s)).filter((s): s is string => !!s));
    if (src === "paste") menuText = String(cancel(await p.text({ message: "Paste the menu (category lines, then 'Item $9.95 - description')" })));
  }
  if ((menuFiles.length || menuUrls.length || (menuText && !/\$\s?\d/.test(menuText.slice(0, 2000)))) && !process.env.ANTHROPIC_API_KEY) {
    const k = await askKey("ANTHROPIC_API_KEY", "Claude reads menus from websites, PDFs and photos into the menu (sizes, toppings, prices). That needs an Anthropic API key (console.anthropic.com → API keys).");
    if (k) process.env.ANTHROPIC_API_KEY = k;
  }
  const aiReady = !!process.env.ANTHROPIC_API_KEY;
  if (menuText || menuFiles.length || menuUrls.length) {
    spin.start(aiReady ? "Claude is reading the menu" : "Reading the menu (no AI key — simple format only)");
    try {
      if (aiReady) menu = await readMenu({ text: menuText || undefined, files: menuFiles, urls: menuUrls });
      // a whole web page isn't a typed menu: without Claude, leave it for Admin → Menu
      else if (menuText && !menuFromSite) menu = parsePlainMenu(menuText);
      const n = menu?.categories.reduce((a, c) => a + c.items.length, 0) ?? 0;
      spin.stop(menu ? `Menu: ${n} items in ${menu.categories.length} sections` : "Menu skipped: add an Anthropic key (create-tbj-resturant login) to read it from their website, or add it in Admin → Menu");
      if (menu) intake.sources.menu = aiReady ? "ai" : "manual";
    } catch (e) {
      spin.stop(`Menu import failed: ${(e as Error).message}`, 1);
    }
  }
  intake.menu = menu;

  // 5b. Menu times: breakfast / lunch / dinner sections that are only served part of the day
  const sections = menu?.categories.map((c) => c.name) ?? [];
  const guessed = guessMenuTimes(sections);
  if (scripted) intake.menuTimes = scripted.menuTimes ?? guessed;
  else if (sections.length) {
    const chosen = cancel(await p.multiselect({
      message: "Any sections only served part of the day? (Space to pick, Enter for none)",
      options: PRESETS.map((x) => ({ value: x.name, label: x.name, hint: guessed.some((g) => g.name === x.name) ? "found in the menu" : undefined })),
      initialValues: guessed.map((g) => g.name),
      required: false,
    })) as string[];
    intake.menuTimes = [];
    for (const name of chosen) {
      const preset = PRESETS.find((x) => x.name === name)!;
      const range = parseRange(String(cancel(await p.text({ message: `${name} hours?`, initialValue: `${preset.startsAt}-${preset.endsAt}`, validate: (v) => (parseRange(v ?? "") ? undefined : "Like 7-11, 11am-3pm or 22:00-02:00") }))))!;
      const secs = cancel(await p.multiselect({ message: `Which sections are ${name.toLowerCase()} only?`, options: sections.map((x) => ({ value: x, label: x })), initialValues: guessed.find((g) => g.name === name)?.sections ?? [], required: true })) as string[];
      intake.menuTimes.push({ name, startsAt: range[0], endsAt: range[1], sections: secs });
    }
  }

  // 6. Photos: AI sorting into hero / item / gallery / event
  if (intake.photos.length && aiReady) {
    spin.start(`Sorting ${intake.photos.length} photos`);
    try {
      intake.photos = await sortPhotos(intake.photos, menu?.categories.flatMap((c) => c.items.map((i) => i.name)) ?? [], gKey);
      const count = (r: Photo["role"]) => intake.photos.filter((x) => x.role === r).length;
      spin.stop(`Photos: ${count("hero")} hero, ${count("item")} matched to menu items, ${count("gallery")} gallery, ${count("skip")} skipped`);
    } catch (e) {
      spin.stop(`Photo sorting skipped: ${(e as Error).message}`, 1);
    }
  } else if (intake.photos.length) p.log.info(`${intake.photos.length} photos found (add an Anthropic key to sort them automatically).`);

  intake.timezone = timezoneFor(intake.address);

  // 6b. The look → src/config/business-theme.ts. Starts from what was found (logo and icon from
  // their website, listing photos, site color); anything can be replaced with a file.
  const clientsDir = switching ? path.join(switching.root, "clients") : ROOT;
  const clientDir = path.join(clientsDir, intake.slug);
  const listingBanners = pickBanners(intake.photos);
  const foundColor = intake.theme?.primary;
  if (!scripted)
    p.log.info([
      `Look so far: logo ${found.logo ? "from their website" : "none (name in text)"}`,
      `app icon ${found.icon ? "from their website" : "first letter on the brand colors"}`,
      `${listingBanners.length} home page photos`,
      `accent ${foundColor ?? "#F5A524 (default)"}`,
    ].join(" · "));
  const change = scripted ? true : cancel(await p.confirm({ message: "Add or change the logo, app icon, photos, colors or fonts?", initialValue: !found.logo }));
  let logo: string | undefined, icon: string | undefined, ownPhotos: string[] = [];
  let accent: string | undefined, header: string | undefined, headingFont = "system", bodyFont = "system";
  if (change) {
    const imageCheck = (v: string) => checkImage(clean(v)!) ?? undefined;
    const keep = (has?: string) => (has ? "Enter to keep the one we found" : "Enter to skip");
    logo = await optional("logo", "Logo file? (PNG with a see-through background works best)", { placeholder: keep(found.logo), validate: imageCheck });
    icon = await optional("icon", "App icon file? (square, 1024 × 1024)", { placeholder: keep(found.icon), validate: imageCheck });
    const splitFiles = (v: string) => v.split(",").map((f) => clean(f)).filter((f): f is string => !!f);
    ownPhotos = scripted ? scripted.photos ?? [] : splitFiles((await optional("photos", "Home page photos? File paths, comma separated", {
      placeholder: listingBanners.length ? `Enter to keep the ${listingBanners.length} listing photos` : "Enter to skip",
      validate: (v) => splitFiles(v).map((f) => (checkImage(f) ? `${f}: ${checkImage(f)}` : "")).find(Boolean) || undefined,
    })) ?? "");
    const hex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? undefined : "A color like #F5A524");
    accent = await optional("accent", "Accent color (buttons, highlights)?", { initialValue: scripted ? undefined : foundColor ?? "#F5A524", validate: hex });
    header = await optional("header", "Header color (top bars, app background)?", { initialValue: scripted ? undefined : "#18181b", validate: hex });
    const fontOptions = FONT_CHOICES.map(([value, label]) => ({ value, label }));
    headingFont = (await ask<string>("headingFont", () => p.select({ message: "Heading font (name, page titles)?", options: fontOptions, initialValue: "system" }))) ?? "system";
    bodyFont = (await ask<string>("bodyFont", () => p.select({ message: "Body font?", options: fontOptions, initialValue: "system" }))) ?? "system";
  }
  for (const f of [logo, icon, ...ownPhotos]) if (f && checkImage(f)) throw new Error(`${f}: ${checkImage(f)}`);
  spin.start("Saving the logo, icon and photos");
  const files = await collectBrandFiles(clientDir, { logo: logo ?? found.logo, icon: icon ?? found.icon, banners: ownPhotos });
  spin.stop(`Saved ${[files.logoFile && "logo", files.iconFile && "app icon", files.bannerFiles?.length && `${files.bannerFiles.length} photos`].filter(Boolean).join(", ") || "no image files (defaults used)"}`);
  intake.branding = {
    ...files,
    banners: listingBanners,
    fonts: { heading: headingFont, body: bodyFont },
    colors: { accent: accent ?? foundColor, header: header ?? intake.theme?.header },
  };
  intake.app = { androidPackage: scripted?.androidPackage ?? packageIdFor(domainFor(intake)) };

  // 6c. Delivery: our site takes the order, DoorDash Drive or Uber Direct sends the driver
  const deliveryChoice = await ask<string>("delivery", () => p.select({
    message: "Offer delivery? (orders stay on their site; a DoorDash or Uber driver brings it, no 30% app commission)",
    options: [
      { value: "doordash", label: "Yes, DoorDash drivers", hint: "DoorDash Drive" },
      { value: "uber", label: "Yes, Uber drivers", hint: "Uber Direct" },
      { value: "none", label: "No, pickup only" },
    ],
    initialValue: "doordash",
  }));
  if (deliveryChoice && deliveryChoice !== "none") {
    const fee = await ask<string>("deliveryFee", () => p.text({ message: "Delivery fee the customer pays? (\"quote\" = the driver's price, or a flat amount like 2.99)", initialValue: "quote", validate: (v) => (v === "quote" || /^\d+(\.\d{1,2})?$/.test(v ?? "") ? undefined : "\"quote\" or an amount like 2.99") }));
    const min = await ask<string>("deliveryMin", () => p.text({ message: "Minimum order for delivery ($)?", initialValue: "15", validate: (v) => (/^\d+(\.\d{1,2})?$/.test(v ?? "") ? undefined : "An amount like 15") }));
    intake.delivery = {
      enabled: true, provider: deliveryChoice as DeliverySettings["provider"],
      customerFee: !fee || fee === "quote" ? "quote" : Math.round(Number(fee) * 100),
      minOrderCents: Math.round(Number(min ?? 15) * 100),
    };
  }

  // 7. Features
  intake.features = scripted?.features ?? Object.fromEntries(((cancel(await p.multiselect({
    message: "Demo features",
    options: [{ value: "ordering", label: "Online ordering" }, { value: "events", label: "Events" }, { value: "scheduling", label: "Staff scheduling" }, { value: "newsletter", label: "Newsletter" }, { value: "voice", label: "Voice ordering" }],
    initialValues: ["ordering", "events", "scheduling", "newsletter"],
  })) as string[]).map((f) => [f, true])));

  // 8. Review + write
  const guesses = [...(menu?.guesses ?? []), ...(!intake.hours ? ["Hours: default 11 AM–9 PM, confirm with owner"] : []), ...(!intake.phone ? ["Phone missing"] : [])];
  p.note([
    `Name      ${intake.name}`, `Address   ${intake.address ?? "—"} (${intake.sources.address ?? "missing"})`, `Phone     ${intake.phone ?? "—"}`,
    `Website   ${intake.website ?? "—"}`, `Menu      ${menu ? menu.categories.map((c) => `${c.name} (${c.items.length})`).join(", ") : "none — add in admin"}`,
    `Photos    ${intake.photos.length} (${intake.photos.filter((x) => !x.owned).length} from listings: demo only, credited)`,
    `Times     ${intake.menuTimes?.length ? intake.menuTimes.map((t) => `${t.name} ${t.startsAt}–${t.endsAt} (${t.sections.join(", ")})`).join("; ") : "all sections whenever open"}`,
    `Look      logo ${intake.branding.logoFile ? "yes" : "none"} · icon ${intake.branding.iconFile ? "yes" : "letter"} · ${intake.branding.bannerFiles?.length ?? 0} own + ${listingBanners.length} listing photos · fonts ${intake.branding.fonts?.heading}/${intake.branding.fonts?.body} · ${intake.branding.colors?.accent ?? "#F5A524"}`,
    `Delivery  ${intake.delivery ? `${intake.delivery.provider === "uber" ? "Uber" : "DoorDash"} drivers · customer pays ${intake.delivery.customerFee === "quote" ? "the quoted fee" : `$${(intake.delivery.customerFee / 100).toFixed(2)}`} · $${intake.delivery.minOrderCents / 100} minimum` : "pickup only"}`,
    `App id    ${intake.app.androidPackage}`,
    ...(guesses.length ? ["", "Check with the owner:", ...guesses.map((g) => `  • ${g}`)] : []),
  ].join("\n"), "Review");
  if (!scripted && !cancel(await p.confirm({ message: "Write the client files?" }))) return p.cancel("Nothing written.");

  const dir = writeClient(clientsDir, intake, guesses);
  if (!switching) return p.outro(`Wrote ${path.relative(process.cwd(), dir)}. Next, inside the app repo: \`create-tbj-restaurant switch --answers\` or \`pnpm import-client ${intake.slug}\`.`);

  await switching.beforeApply?.();
  const deploy = !switching.creating && (switching.deploy || (!scripted && cancel(await p.confirm({ message: "Push it so the Vercel preview site switches too?" })) === true));
  try {
    // The live preview's database is updated during the Vercel build (scripts/setup-db.ts),
    // so no database password is needed here. --local also loads the local dev database.
    const log = applyToApp(intake, { root: switching.root, clientsDir, deploy, skipImport: !switching.local });
    for (const line of log) p.log.success(line);
  } catch (e) {
    p.log.error((e as Error).message);
    process.exit(1);
  }
  if (switching.creating) return intake;
  p.outro(deploy ? `The preview site will show ${intake.name} in about 2 minutes.` : `Local config now points at ${intake.name}. Run with --deploy to update the preview site.`);
}

/** Writes ./store: Bubblewrap (Play Store) and Capacitor (App Store) projects for the current site. */
async function store() {
  const root = findAppRoot();
  if (!root) {
    console.error("Run this inside the restaurant app repo.");
    process.exit(1);
  }
  // the app's config is TypeScript: read it with the app's own tsx
  const code = `Promise.all([import("./src/config/restaurant.ts"), import("./src/config/business-theme.ts")]).then(([a, b]) => console.log(JSON.stringify({ restaurant: a.restaurant, businessTheme: b.businessTheme })))`;
  const out = spawnSync("pnpm", ["exec", "tsx", "-e", code], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (out.status !== 0) {
    console.error("Couldn't read the app's config. Run `pnpm install` in the app first.");
    process.exit(1);
  }
  const { restaurant, businessTheme } = JSON.parse(out.stdout.trim().split("\n").pop()!);
  const url = (flag("url") ?? `https://${restaurant.domain}`).replace(/\/$/, "");
  const androidPackage = restaurant.app?.androidPackage ?? packageIdFor(restaurant.domain);
  const dir = path.join(root, "store");
  writeStoreKit(dir, {
    name: restaurant.name, shortName: restaurant.shortName, url, androidPackage, iosBundleId: restaurant.app?.iosBundleId ?? androidPackage,
    themeColor: businessTheme.colors.header, backgroundColor: businessTheme.colors.header,
  });
  console.log(`Wrote ${path.relative(process.cwd(), dir) || "."}/ for ${url} (${androidPackage}). Next steps: store/README.md`);
}

function list() {
  if (!fs.existsSync(ROOT)) return console.log("No intakes yet.");
  for (const d of fs.readdirSync(ROOT)) {
    const f = path.join(ROOT, d, "intake.json");
    if (fs.existsSync(f)) {
      const i = JSON.parse(fs.readFileSync(f, "utf8")) as Intake;
      console.log(`${i.slug.padEnd(28)} ${i.name.padEnd(32)} ${i.city ?? ""}  ${i.createdAt.slice(0, 10)}`);
    }
  }
}

const [cmd, ...rest0] = process.argv.slice(2);
// `npx create-tbj-resturant --google "…"`: the first word is a flag, not a folder or command
const rest = cmd?.startsWith("--") ? [cmd, ...rest0] : rest0;
const answersIdx = rest.indexOf("--answers");
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const readAnswers = (): Answers | null => (answersIdx >= 0 ? JSON.parse(fs.readFileSync(rest[answersIdx + 1], "utf8")) : null);

/** Flags pre-answer the questionnaire; anything missing is asked interactively. */
function flagAnswers(): Answers | null {
  let answers = readAnswers();
  const google = flag("google");
  const yelp = flag("yelp");
  const website = flag("website");
  if (!answers && (google || yelp || website || flag("name"))) {
    const [gName, ...gCity] = (google ?? "").split(",").map((x) => x.trim());
    answers = {
      name: flag("name") ?? gName ?? "",
      city: flag("city") ?? gCity.join(", "),
      google: !!google,
      yelp: yelp ?? "",
      website: website ?? "",
      // one-line form: "Breakfast\nPancakes $9.95" (Windows shells can double the backslash)
      menuText: flag("menu-text")?.replace(/\\+n/g, "\n"),
      menuFiles: flag("menu-file") ? [flag("menu-file")!] : undefined,
      address: flag("address"), phone: flag("phone"), email: flag("email"),
      logo: flag("logo"), icon: flag("icon"), photos: flag("photos")?.split(",").map((x) => x.trim()).filter(Boolean),
      accent: flag("accent"), header: flag("header"), headingFont: flag("heading-font"), bodyFont: flag("body-font"),
      delivery: flag("delivery") ?? "none", deliveryFee: flag("delivery-fee"), deliveryMin: flag("delivery-min"),
      features: { ordering: true, events: true, scheduling: true, newsletter: true },
    };
    if (!answers.name) {
      console.error(`Give the business name: --google "John's Diner, Indio, CA" or --name "John's Diner" --city "Indio, CA"`);
      process.exit(1);
    }
  }
  return answers;
}

/** npx create-tbj-resturant [folder]: a new app from the template, set up for one restaurant. */
async function createApp(folderArg?: string) {
  p.intro("New TBJ restaurant app");
  const answers = flagAnswers();
  const folder = folderArg ?? (answers?.name ? folderName(answers.name) : String(cancel(await p.text({
    message: "Folder for the new app?", placeholder: "johns-diner", validate: (v) => (v && /^[\w.-]+$/.test(v) ? undefined : "Letters, numbers and dashes"),
  }))));
  const dir = path.resolve(folder);
  try {
    await copyTemplate(dir, flag("template") ?? TEMPLATE);
  } catch (e) {
    p.cancel((e as Error).message);
    process.exit(1);
  }
  // install while the questions are answered; wait for it (with a timer) before loading the menu
  const install = startInstall(dir);
  if (!answers) p.log.info("Installing in the background while you answer the questions.");
  const finish = async () => {
    try {
      await install.finish();
    } catch (e) {
      p.cancel(`Install failed:\n${(e as Error).message}`);
      process.exit(1);
    }
  };
  const intake = await newRestaurant(answers, { root: dir, deploy: false, local: true, creating: true, beforeApply: finish });
  if (!intake) return;
  const repo = await finishProject(dir, intake.name, folderName(intake.name), !answers);
  p.note(nextSteps(dir, repo), "Next");
  p.outro(`${intake.name} is ready in ${path.relative(process.cwd(), dir) || "."}`);
}

const COMMANDS = ["login", "new", "switch", "list", "store", "help", "--help"];
if (cmd === "login") await login();
else if (cmd === "new") await newRestaurant(readAnswers());
else if (cmd === "switch") {
  const root = findAppRoot();
  if (!root) {
    console.error("Run this inside the restaurant app repo (the folder with src/config/restaurant.ts).");
    process.exit(1);
  }
  await newRestaurant(flagAnswers(), { root, deploy: rest.includes("--deploy"), local: rest.includes("--local") });
}
else if (cmd === "list") list();
else if (cmd === "store") await store();
else if (!COMMANDS.includes(cmd ?? "help") || cmd === undefined) await createApp(cmd?.startsWith("--") ? undefined : cmd);
else console.log("Usage: npx create-tbj-resturant [folder] [--google \"Name, City\" …]  |  create-tbj-resturant <login | new [--answers file.json] | list | switch [--google \"Name, City\" | --yelp url | --website url] [--logo f] [--icon f] [--photos a,b] [--delivery doordash|uber|none] [--deploy] [--local] | store [--url https://…]>");
