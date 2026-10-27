import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

// DATABASE_URL set → Neon (demo shared project or the client's own).
// Not set → embedded Postgres (PGlite) in ./.data, so the app runs locally with zero setup.
export type Db = PgliteDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: Db; __dbReady?: Promise<void> };
const migrationsFolder = path.join(process.cwd(), "drizzle");

function create(): Db {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon(neon(url), { schema }) as unknown as Db;
  const dir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  return drizzlePglite(client, { schema });
}

export const db: Db = (g.__db ??= create());

/** Runs migrations and the first-run seed once per process. Await before any query. */
export function ready(): Promise<void> {
  g.__dbReady ??= (async () => {
    if (process.env.DATABASE_URL) await migrateNeon(db as never, { migrationsFolder });
    else await migratePglite(db, { migrationsFolder });
    await seedIfEmpty(db);
  })().catch((e) => {
    g.__dbReady = undefined;
    throw e;
  });
  return g.__dbReady;
}

export async function getDb(): Promise<Db> {
  await ready();
  return db;
}

export { schema };
