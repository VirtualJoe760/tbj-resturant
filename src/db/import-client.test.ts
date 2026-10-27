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
});
