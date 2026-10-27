// Loads a create-tbj-restaurant intake (clients/<slug>/) into the database: brand, location,
// hours, menu and menu times. The look (logo, icon, banners, fonts, colors) is not here: the CLI
// writes it to src/config/business-theme.ts. Orders, staff and test accounts are left alone.
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as s from "./schema";
import { DEFAULT_DAYPARTS } from "../domain/dayparts";

interface MenuTime { name: string; startsAt: string; endsAt: string; days?: number[]; sections: string[] }
interface PhotoJson { source: string; url: string; ref?: string; role?: string; itemName?: string }

/** Where the site loads a listing photo from (Google through /api/places-photo; never a URL with a key). */
export function photoSrc(p: PhotoJson) {
  const u = p.source === "google" && p.ref ? `/api/places-photo?name=${p.ref}` : p.url;
  return u.startsWith("/") || (u.startsWith("https://") && !/[?&]key=/i.test(u)) ? u : undefined;
}
interface MenuJson {
  categories: { name: string; items: { name: string; description: string; price_cents: number; orderable_online: boolean; tags: string[];
    modifier_groups: { name: string; kind: "choice" | "addon" | "removal" | "option"; min: number; max: number; options: { name: string; price_cents: number; is_default: boolean }[] }[] }[] }[];
}

/** "The Hood Bar & Pizza" → "The Hood"; short names stay as they are. */
export function shortNameOf(name: string) {
  if (name.length <= 16) return name;
  const cut = name.split(/\s+(?:Bar\b|Restaurant\b|Grill\b|Pizzeria\b|Pizza\b|Cafe\b|Café|Kitchen\b|Diner\b|Tavern\b|Cantina\b|&|and\b|-|–)/i)[0].trim();
  return cut.length >= 3 ? cut : name.split(/\s+/).slice(0, 2).join(" ");
}

const slug = (x: string) => x.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const EMOJI: [RegExp, string][] = [[/pizza|pie/i, "🍕"], [/wing|chicken|tender/i, "🍗"], [/salad/i, "🥗"], [/burger/i, "🍔"], [/taco|nacho/i, "🌮"], [/beer|ipa|lager/i, "🍺"], [/wine/i, "🍷"], [/soda|drink|lemonade/i, "🥤"], [/fries|tots/i, "🍟"], [/sandwich|philly|sub/i, "🥪"], [/dessert|cookie|cake/i, "🍰"]];

export async function importClient(db: PgliteDatabase<typeof s>, dir: string) {
  const intake = JSON.parse(fs.readFileSync(path.join(dir, "intake.json"), "utf8"));
  const menuFile = path.join(dir, "menu.json");
  const menu: MenuJson | null = fs.existsSync(menuFile) ? JSON.parse(fs.readFileSync(menuFile, "utf8")) : null;

  // What the site was before, so pages and test accounts can be renamed to the new business.
  const [prev] = await db.select().from(s.brand).where(eq(s.brand.id, "brand"));
  const prevSettings = (prev?.settings ?? {}) as { shortName?: string; domain?: string };
  const users = await db.select().from(s.user).where(eq(s.user.isTestAccount, true));
  const oldDomain = prevSettings.domain ?? users[0]?.email.split("@")[1];
  const oldNames = [prev?.name, prevSettings.shortName ?? shortNameOf(prev?.name ?? "")].filter((x): x is string => !!x && x.length > 2);
  const newShort: string = intake.shortName ?? shortNameOf(intake.name);
  const rename = (text: string) => oldNames.reduce((t, n) => t.split(n).join(n === prev?.name ? intake.name : newShort), text);

  // a new business starts from its own business-theme.ts, so drop the old one's admin changes and
  // uploads, and the old one's events (the owner adds their own in Admin → Events)
  await db.delete(s.media);
  const firstImport = (prev?.settings as { importedSlug?: string } | undefined)?.importedSlug !== intake.slug;
  if (firstImport) await db.delete(s.events); // the template's sample events belong to The Hood
  await db.update(s.brand).set({ name: intake.name, settings: { theme: intake.theme ?? null, links: intake.links, slug: intake.slug, shortName: newShort, domain: intake.domain ?? oldDomain, importedSlug: intake.slug } }).where(eq(s.brand.id, "brand"));
  for (const pg of await db.select().from(s.pages))
    await db.update(s.pages).set({ title: rename(pg.title), subtitle: rename(pg.subtitle), bodyHtml: rename(pg.bodyHtml), updatedAt: new Date() }).where(eq(s.pages.id, pg.id));
  if (intake.domain && oldDomain && intake.domain !== oldDomain)
    for (const u of users) await db.update(s.user).set({ email: u.email.replace(`@${oldDomain}`, `@${intake.domain}`) }).where(eq(s.user.id, u.id));
  await db.update(s.locations).set({
    name: intake.city?.split(",")[0] ?? "Main", address: intake.address ?? "", phone: intake.phone ?? null,
    ...(intake.location ? { lat: intake.location.lat, lng: intake.location.lng } : {}),
  }).where(eq(s.locations.id, "main"));
  // no hours found → 11 AM–9 PM every day, flagged in owner-questions.md
  const hours: { weekday: number; opensAt: string; closesAt: string }[] = intake.hours?.length ? intake.hours : [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "11:00", closesAt: "21:00" }));
  await db.delete(s.locationHours).where(eq(s.locationHours.locationId, "main"));
  await db.insert(s.locationHours).values(hours.map((h) => ({ locationId: "main", ...h })));
  // replace the menu (featured items and item links cascade); no menu yet = start empty, added in Admin → Menu
  await db.delete(s.featuredItems);
  await db.delete(s.itemModifierGroups);
  await db.delete(s.items);
  await db.delete(s.modifiers);
  await db.delete(s.modifierGroups);
  await db.delete(s.categories);
  await db.delete(s.dayparts);
  // menu times: what the intake says, else guessed from section names ("Breakfast", "Lunch specials")
  const times: MenuTime[] = intake.menuTimes?.length ? intake.menuTimes
    : DEFAULT_DAYPARTS.map((d) => ({ name: d.name, startsAt: d.startsAt, endsAt: d.endsAt, sections: (menu?.categories ?? []).map((c) => c.name).filter((n) => d.match.test(n)) })).filter((t) => t.sections.length);
  const daypartsFor: Record<string, string[]> = {};
  for (const [i, t] of times.entries()) {
    const [dp] = await db.insert(s.dayparts).values({ name: t.name, startsAt: t.startsAt, endsAt: t.endsAt, days: t.days ?? [0, 1, 2, 3, 4, 5, 6], sort: i }).returning({ id: s.dayparts.id });
    for (const sec of t.sections) (daypartsFor[sec.toLowerCase()] ??= []).push(dp.id);
  }
  let n = 0;
  if (!menu) return { items: 0 };
  // dish photos the CLI matched to menu items become each item's photo carousel
  const photosFile = path.join(dir, "photos.json");
  const photos: PhotoJson[] = fs.existsSync(photosFile) ? JSON.parse(fs.readFileSync(photosFile, "utf8")) : [];
  const imagesFor = (name: string) => photos.filter((x) => x.itemName?.toLowerCase() === name.toLowerCase()).map(photoSrc).filter((u): u is string => !!u).slice(0, 6);
  for (const [ci, c] of menu.categories.entries()) {
    const catId = slug(c.name) || `cat-${ci}`;
    await db.insert(s.categories).values({ id: catId, name: c.name, sort: ci, daypartIds: daypartsFor[c.name.toLowerCase()] ?? [] }).onConflictDoNothing();
    for (const [ii, it] of c.items.entries()) {
      const itemId = `${catId}-${slug(it.name)}-${ii}`;
      await db.insert(s.items).values({ id: itemId, categoryId: catId, name: it.name, description: it.description, basePriceCents: it.price_cents, orderableOnline: it.orderable_online, tags: it.tags, emoji: EMOJI.find(([re]) => re.test(it.name + " " + c.name))?.[1] ?? "🍽️", images: imagesFor(it.name), sort: n++ });
      for (const [gi, g] of it.modifier_groups.entries()) {
        const gid = `${itemId}-g${gi}`;
        await db.insert(s.modifierGroups).values({ id: gid, name: g.name, kind: g.kind, minSelect: g.min, maxSelect: g.max });
        await db.insert(s.modifiers).values(g.options.map((o, oi) => ({ id: `${gid}-${oi}`, groupId: gid, name: o.name, priceCents: o.price_cents, isDefault: o.is_default, sort: oi })));
        await db.insert(s.itemModifierGroups).values({ itemId, groupId: gid, sort: gi });
      }
    }
  }
  const first = await db.select().from(s.items).limit(4);
  await db.insert(s.featuredItems).values(first.map((i, k) => ({ itemId: i.id, badge: ["NEW", "STAFF PICK", "FAN FAVE", "TRY IT"][k], blurb: i.description.slice(0, 60), sort: k })));
  return { items: n };
}
