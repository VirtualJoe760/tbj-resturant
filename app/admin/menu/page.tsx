import { asc } from "drizzle-orm";
import { Board86 } from "@/components/Board86";
import { getDb, schema as s } from "@/db/client";
import { isSoldOut } from "@/server/queries";
import { addItem, updateItem } from "@/server/actions/admin";

export const metadata = { title: "Menu" };

export default async function AdminMenu({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "86" } = await searchParams;
  const db = await getDb();
  const [items, cats] = await Promise.all([db.select().from(s.items).orderBy(asc(s.items.sort)), db.select().from(s.categories).orderBy(asc(s.categories.sort))]);
  return (
    <>
      <div className="admin-top"><b>Menu</b><span className="muted small">{items.length} items</span></div>
      <div className="chips">
        <a className={tab === "86" ? "on" : ""} href="/admin/menu?tab=86">86 board</a>
        <a className={tab === "edit" ? "on" : ""} href="/admin/menu?tab=edit">Edit items</a>
      </div>
      {tab === "86" ? (
        <Board86 items={cats.flatMap((c) => items.filter((i) => i.categoryId === c.id && i.isActive).map((i) => ({ id: i.id, name: i.name, emoji: i.emoji, basePriceCents: i.basePriceCents, soldOut: isSoldOut(i), category: c.name })))} />
      ) : (
        <>
          <details className="panel">
            <summary style={{ padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>+ Add item</summary>
            <form action={addItem}>
              <div className="two">
                <label className="field"><span>Name</span><input name="name" required /></label>
                <label className="field"><span>Price ($)</span><input name="price" type="number" step="0.01" min="0" required /></label>
              </div>
              <div className="two">
                <label className="field"><span>Category</span><select name="categoryId">{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="field"><span>Emoji / icon</span><input name="emoji" placeholder="🍕" /></label>
              </div>
              <label className="field"><span>Description</span><input name="description" /></label>
              <div className="chips"><button className="on">Add to menu</button></div>
            </form>
          </details>
          {cats.map((c) => (
            <div key={c.id}>
              <div className="sec">{c.name}</div>
              {items.filter((i) => i.categoryId === c.id).map((i) => (
                <details className="panel" key={i.id}>
                  <summary style={{ padding: "10px 12px", cursor: "pointer" }}>{i.emoji} <b>{i.name}</b> · ${(i.basePriceCents / 100).toFixed(2)}{!i.isActive && <span className="kind" style={{ marginLeft: 6 }}>Hidden</span>}</summary>
                  <form action={updateItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <div className="two">
                      <label className="field"><span>Name</span><input name="name" defaultValue={i.name} /></label>
                      <label className="field"><span>Base price ($)</span><input name="price" type="number" step="0.01" min="0" defaultValue={(i.basePriceCents / 100).toFixed(2)} /></label>
                    </div>
                    <label className="field"><span>Description</span><input name="description" defaultValue={i.description} /></label>
                    <label className="chk"><input type="checkbox" name="isActive" defaultChecked={i.isActive} /> Show on menu</label>
                    <label className="chk"><input type="checkbox" name="orderableOnline" defaultChecked={i.orderableOnline} /> Can be ordered online (off for alcohol)</label>
                    <div className="chips"><button className="on">Save</button></div>
                  </form>
                </details>
              ))}
            </div>
          ))}
          <p className="note">Modifier groups (sizes, toppings, &quot;comes with&quot;) are shared across items; the full modifier editor is in the build plan.</p>
        </>
      )}
    </>
  );
}
