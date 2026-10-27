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

const g = globalThis as unknown as { __db?: Db; __pglite?: PGlite; __dbReady?: Promise<void>; __closeHooked?: boolean };
const migrationsFolder = path.join(process.cwd(), "drizzle");
const dataDir = path.join(process.cwd(), ".data", "pglite");

function create(): Db {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon(neon(url), { schema }) as unknown as Db;
  fs.mkdirSync(dataDir, { recursive: true });
  g.__pglite = new PGlite(dataDir);
  if (!g.__closeHooked) {
    // close cleanly so a stopped dev server doesn't leave the data files half-written
    g.__closeHooked = true;
    const close = () => g.__pglite?.close().finally(() => process.exit(0));
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  }
  return drizzlePglite(g.__pglite, { schema });
}

g.__db ??= create();

/** Always points at the current connection (it is replaced if the local demo DB has to be rebuilt). */
export const db: Db = new Proxy({} as Db, { get: (_, key) => Reflect.get(g.__db!, key) });

async function migrateAndSeed() {
  if (process.env.DATABASE_URL) await migrateNeon(g.__db as never, { migrationsFolder });
  else await migratePglite(g.__db!, { migrationsFolder });
  await seedIfEmpty(g.__db!);
}

/** Runs migrations and the first-run seed once per process. Await before any query. */
export function ready(): Promise<void> {
  g.__dbReady ??= (async () => {
    try {
      await migrateAndSeed();
    } catch (e) {
      if (process.env.DATABASE_URL) throw e;
      // Local demo data only: set a damaged database aside and start fresh from the seed.
      console.warn("Local database could not be opened; rebuilding it from seed data.", e);
      await g.__pglite?.close().catch(() => {});
      if (fs.existsSync(dataDir)) fs.renameSync(dataDir, `${dataDir}-broken-${Date.now()}`);
      g.__db = create();
      await migrateAndSeed();
    }
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
