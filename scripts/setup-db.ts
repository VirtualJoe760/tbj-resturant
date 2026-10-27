// Runs before `next build` on Vercel: applies migrations, seeds an empty database, and — when
// `create-restaurant switch` pointed the demo at a new business — loads that business
// (clients/<slug>/) into the database. No database password ever leaves Vercel.
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, ready, schema } from "../src/db/client";
import { importClient } from "../src/db/import-client";
import { restaurant } from "../src/config/restaurant";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("setup-db: no DATABASE_URL, skipping (local runs use the embedded database)");
    return;
  }
  await ready();
  console.log("setup-db: migrations applied, seed checked");
  const [brand] = await db.select().from(schema.brand).where(eq(schema.brand.id, "brand"));
  const current = (brand?.settings as { slug?: string } | null)?.slug;
  const dir = path.resolve("clients", restaurant.slug);
  if (current !== restaurant.slug && fs.existsSync(path.join(dir, "intake.json"))) {
    const r = await importClient(db, dir);
    console.log(`setup-db: switched demo from ${current ?? "(seed)"} to ${restaurant.slug} (${r.items} menu items)`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
