import path from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { verifyPassword } from "better-auth/crypto";
import * as schema from "./schema";
import { loadItemDefs, seedIfEmpty } from "./seed";
import { TEST_PASSWORD } from "./test-accounts";
import { validateSelections } from "@/domain/cart";
import { defaultSelections } from "@/domain/pricing";

describe("seed", () => {
  it("migrates, seeds The Hood and the four test accounts, and is idempotent", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
    await seedIfEmpty(db);
    await seedIfEmpty(db);
    const users = await db.select().from(schema.user);
    expect(users.map((u) => u.email.split("@")[0]).sort()).toEqual(["admin", "customer", "employee", "kitchen"]);
    const acct = await db.select().from(schema.account);
    expect(await verifyPassword({ hash: acct[0].password!, password: TEST_PASSWORD })).toBe(true);
    const defs = await loadItemDefs(db);
    for (const d of Object.values(defs)) expect(validateSelections(d, defaultSelections(d)).errors).toEqual([]);
    expect((await db.select().from(schema.orders)).length).toBe(6);
  });
});
