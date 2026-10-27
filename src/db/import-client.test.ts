import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { loadItemDefs, seedIfEmpty } from "./seed";
import { importClient } from "./import-client";
import { defaultSelections, priceLine } from "@/domain/pricing";

describe("import-client", () => {
  it("replaces brand, hours and menu from an intake folder", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
    await seedIfEmpty(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intake-"));
    fs.writeFileSync(path.join(dir, "intake.json"), JSON.stringify({ slug: "tonys", name: "Tony's", shortName: "Tony's", domain: "tonys.com", city: "Indio, CA", address: "1 Main St", phone: "555", links: {}, hours: [{ weekday: 1, opensAt: "11:00", closesAt: "21:00" }] }));
    fs.writeFileSync(path.join(dir, "menu.json"), JSON.stringify({ categories: [{ name: "Pizza", items: [{ name: "Cheese", description: "", price_cents: 1200, orderable_online: true, tags: [],
      modifier_groups: [{ name: "Size", kind: "choice", min: 1, max: 1, options: [{ name: "Small", price_cents: 0, is_default: true }, { name: "Large", price_cents: 600, is_default: false }] }] }] }], guesses: [] }));
    expect((await importClient(db, dir)).items).toBe(1);
    const defs = Object.values(await loadItemDefs(db));
    expect(defs).toHaveLength(1);
    expect(priceLine(defs[0], defaultSelections(defs[0]))).toBe(1200);
    expect((await db.select().from(schema.brand))[0].name).toBe("Tony's");
    const titles = (await db.select().from(schema.pages)).map((p) => p.title);
    expect(titles).toContain("Play at Tony's");
    expect(titles).toContain("Work at Tony's");
    expect((await db.select().from(schema.user)).map((u) => u.email.split("@")[1])).toEqual(["tonys.com", "tonys.com", "tonys.com", "tonys.com"]);
  });

  it("creates menu times from section names and clears the old look", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
    await seedIfEmpty(db);
    const [b0] = await db.select().from(schema.brand);
    await db.update(schema.brand).set({ settings: { ...b0.settings, brandingOverrides: { headingFont: "bebas" } } });
    await db.insert(schema.media).values({ mime: "image/png", data: "" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intake-"));
    fs.writeFileSync(path.join(dir, "intake.json"), JSON.stringify({ slug: "johns", name: "John's Diner", domain: "johns.com", city: "Indio", links: {} }));
    const item = { name: "Pancakes", description: "", price_cents: 900, orderable_online: true, tags: [], modifier_groups: [] };
    fs.writeFileSync(path.join(dir, "menu.json"), JSON.stringify({ categories: [{ name: "Breakfast", items: [item] }, { name: "Burgers", items: [{ ...item, name: "Burger" }] }], guesses: [] }));
    await importClient(db, dir);
    expect((await db.select().from(schema.brand))[0].settings).not.toHaveProperty("brandingOverrides");
    expect(await db.select().from(schema.media)).toHaveLength(0);
    const [bf] = await db.select().from(schema.dayparts);
    expect(bf.name).toBe("Breakfast");
    const cats = await db.select().from(schema.categories);
    expect(cats.find((c) => c.name === "Breakfast")!.daypartIds).toEqual([bf.id]);
    expect(cats.find((c) => c.name === "Burgers")!.daypartIds).toEqual([]);
  });

  it("puts matched listing photos on menu items (Google through our proxy, never a key)", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
    await seedIfEmpty(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intake-"));
    fs.writeFileSync(path.join(dir, "intake.json"), JSON.stringify({ slug: "black-cat", name: "Black Cat Pizza", domain: "blackcatpizza.com", city: "Palm Desert", links: {} }));
    const item = { description: "", price_cents: 3100, orderable_online: true, tags: [], modifier_groups: [] };
    fs.writeFileSync(path.join(dir, "menu.json"), JSON.stringify({ categories: [{ name: "Detroit pies", items: [{ ...item, name: "Pepperoni & Hot Honey" }, { ...item, name: "Margherita" }] }], guesses: [] }));
    fs.writeFileSync(path.join(dir, "photos.json"), JSON.stringify([
      { source: "yelp", url: "https://s3-media.yelpcdn.com/a.jpg", role: "item", itemName: "Pepperoni & Hot Honey" },
      { source: "google", url: "https://places.googleapis.com/v1/places/x/photos/y/media", ref: "places/x/photos/y", role: "item", itemName: "pepperoni & hot honey" },
      { source: "website", url: "https://x.com/p.jpg?key=SECRET", role: "item", itemName: "Margherita" },
    ]));
    await importClient(db, dir);
    const items = await db.select().from(schema.items);
    expect(items.find((i) => i.name === "Pepperoni & Hot Honey")!.images).toEqual(["https://s3-media.yelpcdn.com/a.jpg", "/api/places-photo?name=places/x/photos/y"]);
    expect(items.find((i) => i.name === "Margherita")!.images).toEqual([]);
  });
});
