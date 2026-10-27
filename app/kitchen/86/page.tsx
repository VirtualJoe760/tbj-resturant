import { asc } from "drizzle-orm";
import { Board86 } from "@/components/Board86";
import { getDb, schema as s } from "@/db/client";
import { isSoldOut } from "@/server/queries";

export const metadata = { title: "86 board" };

export default async function Kitchen86() {
  const db = await getDb();
  const [items, cats] = await Promise.all([db.select().from(s.items).orderBy(asc(s.items.sort)), db.select().from(s.categories).orderBy(asc(s.categories.sort))]);
  const view = cats.flatMap((c) => items.filter((i) => i.categoryId === c.id && i.isActive).map((i) => ({ id: i.id, name: i.name, emoji: i.emoji, basePriceCents: i.basePriceCents, soldOut: isSoldOut(i), category: c.name })));
  return (
    <>
      <div className="admin-top"><b>86 board</b><span className="muted small">Kitchen can 86 items · menu edits stay in admin</span></div>
      <Board86 items={view} />
    </>
  );
}
