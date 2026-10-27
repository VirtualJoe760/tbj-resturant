// pnpm import-client <slug>  — loads clients/<slug>/ into the database.
// With the embedded local database, stop `pnpm dev` first (one process at a time).
import path from "node:path";
import { db, ready } from "../src/db/client";
import { importClient } from "../src/db/import-client";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: pnpm import-client <slug>");
  process.exit(1);
}
await ready();
const r = await importClient(db, path.resolve(process.env.CR_OUT ?? "clients", slug));
console.log(`Imported ${slug}: ${r.items} menu items. Update src/config/restaurant.ts (name, domain, colors) to match.`);
process.exit(0);
