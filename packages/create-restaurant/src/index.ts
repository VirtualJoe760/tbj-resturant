// create-restaurant: questionnaire → import → client files → (optional) demo deploy.
// Usage:
//   create-restaurant login                 store our API keys (hidden prompts)
//   create-restaurant new [--answers a.json] questionnaire (or answers file for scripted runs)
//   create-restaurant list                  intakes on this machine
//   create-restaurant switch [--google "John's Diner, Indio, CA" | --yelp <url> | --website <url>] [--deploy]
//                                           point this repo's demo site at a different business
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { getKey, KEYS, keyStatus, saveKeys, type KeyName } from "./credentials.ts";
import { searchPlaces, type GooglePlace } from "./sources/google.ts";
import { yelpDetails } from "./sources/yelp.ts";
import { readWebsite } from "./sources/website.ts";
import { readMenu, sortPhotos } from "./sources/ai.ts";
import { parsePlainMenu } from "./sources/manual-menu.ts";
import { writeClient } from "./write.ts";
import { applyToApp, findAppRoot, timezoneFor } from "./apply.ts";
import type { Intake, Menu, Photo } from "./types.ts";

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
  p.intro("Store API keys for create-restaurant");
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
}

interface SwitchOptions {
  root: string;
  deploy: boolean;
  local: boolean;
}

async function newRestaurant(scripted: Answers | null, switching?: SwitchOptions) {
  const ask = async <T>(key: keyof Answers, q: () => Promise<T | symbol>): Promise<T> => (scripted ? (scripted[key] as T) : cancel(await q()));
  for (const k of ["ANTHROPIC_API_KEY"] as KeyName[]) if (!process.env[k] && getKey(k)) process.env[k] = getKey(k);

  p.intro(switching ? "Switch the demo site to a new business" : "New restaurant demo");
  const name = await ask<string>("name", () => p.text({ message: "Restaurant name?", validate: (v) => (v ? undefined : "Required") }));
  const city = await ask<string>("city", () => p.text({ message: "City?", placeholder: "Palm Desert, CA" }));
  const intake: Intake = { slug: slugify(name), name, city, timezone: "America/Los_Angeles", links: {}, photos: [], features: {}, sources: { name: "manual" }, createdAt: new Date().toISOString() };
  const spin = p.spinner();

  // 1. Google Business listing
  const gKey = getKey("GOOGLE_PLACES_API_KEY");
  const hasGoogle = await ask<boolean>("google", () => p.confirm({ message: "Does it have a Google Business listing?" }));
  if (hasGoogle) {
    if (!gKey) p.log.warn("No Google Places key saved — run `create-restaurant login`. Skipping Google.");
    else {
      spin.start("Searching Google");
      let places: GooglePlace[] = [];
      try { places = await searchPlaces(gKey, `${name} ${city}`); } catch (e) { spin.stop((e as Error).message, 1); }
      spin.stop(`${places.length} match${places.length === 1 ? "" : "es"} on Google`);
      const idx = places.length <= 1 || scripted ? 0 : cancel(await p.select({ message: "Which one?", options: [...places.map((x, i) => ({ value: i, label: x.name, hint: x.address })), { value: -1, label: "None of these" }] }));
      const pick = idx === -1 ? undefined : places[idx];
      if (pick) {
        Object.assign(intake, { address: pick.address, phone: pick.phone, website: pick.website, location: pick.location, hours: pick.hours?.length ? pick.hours : undefined, cuisine: pick.category });
        intake.links.google = pick.mapsUrl;
        intake.photos.push(...pick.photos);
        for (const f of ["address", "phone", "website", "location", "hours"]) if ((intake as never)[f]) intake.sources[f] = "google";
      }
    }
  }

  // 2. Yelp
  const yelp = await ask<string>("yelp", async () => ((await p.confirm({ message: "Does it have a Yelp page?" })) === true ? p.text({ message: "Paste the Yelp link" }) : ""));
  if (yelp) {
    intake.links.yelp = yelp;
    const yKey = getKey("YELP_API_KEY");
    if (!yKey) p.log.info("No Yelp key — the Yelp link goes in the footer; details and photos come from other sources.");
    else {
      try {
        spin.start("Reading Yelp");
        const y = await yelpDetails(yKey, yelp);
        intake.photos.push(...y.photos);
        intake.address ??= y.address;
        intake.phone ??= y.phone;
        intake.cuisine ??= y.categories[0];
        spin.stop(`Yelp: ${y.photos.length} photos, ${y.categories.join(", ")}`);
      } catch (e) {
        spin.stop((e as Error).message, 1);
      }
    }
  }

  // 3. Website
  const website = await ask<string>("website", async () => {
    const yes = await p.confirm({ message: `Does it have a website?${intake.website ? ` (Google lists ${intake.website})` : ""}` });
    if (yes !== true) return "";
    return intake.website ?? p.text({ message: "Website address" });
  });
  let siteText = "";
  if (website) {
    spin.start("Reading the website");
    try {
      const w = await readWebsite(website);
      intake.website = w.url;
      intake.email ??= w.email;
      if (w.themeColor) intake.theme = { primary: w.themeColor, header: "#18181b" };
      intake.photos.push(...w.photos);
      siteText = w.text;
      spin.stop(`Website: ${w.photos.length} images${w.menuPdfs.length ? `, ${w.menuPdfs.length} menu PDF` : ""}`);
      if (w.menuPdfs[0]) intake.sources.menuPdf = w.menuPdfs[0];
    } catch (e) {
      spin.stop(`Couldn't read the website: ${(e as Error).message}`, 1);
    }
  }

  // 4. Manual intake when nothing was found
  if (!hasGoogle && !yelp && !website) {
    p.log.step("No listing or website — quick manual intake");
    intake.address = await ask<string>("address", () => p.text({ message: "Address?", validate: (v) => (v ? undefined : "Required") }));
    intake.phone = await ask<string>("phone", () => p.text({ message: "Phone?", validate: (v) => (v ? undefined : "Required") }));
    intake.email = await ask<string>("email", () => p.text({ message: "Owner email?", validate: (v) => (v?.includes("@") ? undefined : "Needs an email") }));
    Object.assign(intake.sources, { address: "manual", phone: "manual", email: "manual" });
  }

  // 5. Menu
  const aiReady = !!process.env.ANTHROPIC_API_KEY;
  let menu: Menu | undefined;
  const menuFiles = scripted?.menuFiles ?? [];
  let menuText = scripted?.menuText ?? "";
  if (!scripted) {
    const src = cancel(await p.select({
      message: "Where's the menu?",
      options: [
        ...(siteText || intake.sources.menuPdf ? [{ value: "site", label: "Found on the website" }] : []),
        { value: "files", label: "PDF or photos on this computer" },
        { value: "paste", label: "Paste the menu text" },
      ],
    }));
    if (src === "site") menuText = siteText;
    if (src === "files") menuFiles.push(...String(cancel(await p.text({ message: "File paths (comma separated)" }))).split(",").map((s) => s.trim()).filter(Boolean));
    if (src === "paste") menuText = String(cancel(await p.text({ message: "Paste the menu (category lines, then 'Item $9.95 - description')" })));
  } else if (!menuText && siteText) menuText = siteText;

  spin.start(aiReady ? "Claude is reading the menu" : "Reading the menu (no AI key — simple format only)");
  try {
    if (aiReady) menu = await readMenu({ text: menuText || undefined, files: menuFiles, urls: intake.sources.menuPdf && !menuText ? [intake.sources.menuPdf] : [] });
    else if (menuText) menu = parsePlainMenu(menuText);
    const n = menu?.categories.reduce((a, c) => a + c.items.length, 0) ?? 0;
    spin.stop(`Menu: ${n} items in ${menu?.categories.length ?? 0} categories`);
    if (menu) intake.sources.menu = aiReady ? "ai" : "manual";
  } catch (e) {
    spin.stop(`Menu import failed: ${(e as Error).message}`, 1);
  }
  intake.menu = menu;

  // 6. Photos: AI sorting into hero / item / gallery / event
  if (intake.photos.length && aiReady) {
    spin.start(`Sorting ${intake.photos.length} photos`);
    try {
      intake.photos = await sortPhotos(intake.photos, menu?.categories.flatMap((c) => c.items.map((i) => i.name)) ?? []);
      const count = (r: Photo["role"]) => intake.photos.filter((x) => x.role === r).length;
      spin.stop(`Photos: ${count("hero")} hero, ${count("item")} matched to menu items, ${count("gallery")} gallery, ${count("skip")} skipped`);
    } catch (e) {
      spin.stop(`Photo sorting skipped: ${(e as Error).message}`, 1);
    }
  } else if (intake.photos.length) p.log.info(`${intake.photos.length} photos found (add an Anthropic key to sort them automatically).`);

  intake.timezone = timezoneFor(intake.address);

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
    ...(guesses.length ? ["", "Check with the owner:", ...guesses.map((g) => `  • ${g}`)] : []),
  ].join("\n"), "Review");
  if (!scripted && !cancel(await p.confirm({ message: "Write the client files?" }))) return p.cancel("Nothing written.");

  const clientsDir = switching ? path.join(switching.root, "clients") : ROOT;
  const dir = writeClient(clientsDir, intake, guesses);
  if (!switching) return p.outro(`Wrote ${path.relative(process.cwd(), dir)}. Next: \`create-restaurant switch --answers\` or \`pnpm import-client ${intake.slug}\`.`);

  const deploy = switching.deploy || (!scripted && cancel(await p.confirm({ message: "Push it so the Vercel preview site switches too?" })) === true);
  try {
    // The live preview's database is updated during the Vercel build (scripts/setup-db.ts),
    // so no database password is needed here. --local also loads the local dev database.
    const log = applyToApp(intake, { root: switching.root, clientsDir, deploy, skipImport: !switching.local });
    for (const line of log) p.log.success(line);
  } catch (e) {
    p.log.error((e as Error).message);
    process.exit(1);
  }
  p.outro(deploy ? `The preview site will show ${intake.name} in about 2 minutes.` : `Local config now points at ${intake.name}. Run with --deploy to update the preview site.`);
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

const [cmd, ...rest] = process.argv.slice(2);
const answersIdx = rest.indexOf("--answers");
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const readAnswers = (): Answers | null => (answersIdx >= 0 ? JSON.parse(fs.readFileSync(rest[answersIdx + 1], "utf8")) : null);

if (cmd === "login") await login();
else if (cmd === "new") await newRestaurant(readAnswers());
else if (cmd === "switch") {
  const root = findAppRoot();
  if (!root) {
    console.error("Run this inside the restaurant app repo (the folder with src/config/restaurant.ts).");
    process.exit(1);
  }
  // Flags pre-answer the questionnaire; anything missing is asked interactively.
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
      menuText: flag("menu-text"),
      menuFiles: flag("menu-file") ? [flag("menu-file")!] : undefined,
      address: flag("address"), phone: flag("phone"), email: flag("email"),
      features: { ordering: true, events: true, scheduling: true, newsletter: true },
    };
    if (!answers.name) {
      console.error(`Give the business name: --google "John's Diner, Indio, CA" or --name "John's Diner" --city "Indio, CA"`);
      process.exit(1);
    }
  }
  await newRestaurant(answers, { root, deploy: rest.includes("--deploy"), local: rest.includes("--local") });
}
else if (cmd === "list") list();
else console.log("Usage: create-restaurant <login | new [--answers file.json] | list | switch [--google \"Name, City\" | --yelp url | --website url] [--deploy] [--local]>");
