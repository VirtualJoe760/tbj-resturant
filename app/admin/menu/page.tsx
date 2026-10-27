import { asc } from "drizzle-orm";
import { Board86 } from "@/components/Board86";
import { getDb, schema as s } from "@/db/client";
import { isSoldOut } from "@/server/queries";
import { addItem, deleteDaypart, saveDaypart, setCategoryDayparts, updateItem } from "@/server/actions/admin";
import { daypartLabel } from "@/domain/dayparts";
import { ItemPhotos } from "@/components/ItemPhotos";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const metadata = { title: "Menu" };

export default async function AdminMenu({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "86" } = await searchParams;
  const db = await getDb();
  const [items, cats, dps] = await Promise.all([db.select().from(s.items).orderBy(asc(s.items.sort)), db.select().from(s.categories).orderBy(asc(s.categories.sort)), db.select().from(s.dayparts).orderBy(asc(s.dayparts.startsAt))]);
  return (
    <>
      <div className="admin-top"><b>Menu</b><span className="muted small">{items.length} items</span></div>
      <div className="chips">
        <a className={tab === "86" ? "on" : ""} href="/admin/menu?tab=86">86 board</a>
        <a className={tab === "edit" ? "on" : ""} href="/admin/menu?tab=edit">Edit items</a>
        <a className={tab === "times" ? "on" : ""} href="/admin/menu?tab=times">Menu times</a>
      </div>
      {tab === "times" ? (
        <>
          <p className="note">Serve breakfast, lunch or dinner at set times. Sections tied to a menu time can only be ordered during it; sections with none follow your opening hours.</p>
          <div className="sec">Menu times</div>
          {dps.map((d) => (
            <details className="panel" key={d.id}>
              <summary style={{ padding: "10px 12px", cursor: "pointer" }}><b>{daypartLabel(d)}</b></summary>
              <DaypartForm d={d} />
              <form action={deleteDaypart.bind(null, d.id)} className="chips"><button>Delete {d.name}</button></form>
            </details>
          ))}
          <details className="panel" open={!dps.length}>
            <summary style={{ padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>+ Add a menu time</summary>
            <DaypartForm />
          </details>
          <div className="sec">Which sections are served when</div>
          {cats.map((c) => (
            <form className="panel" key={c.id} action={setCategoryDayparts} style={{ padding: "8px 0" }}>
              <input type="hidden" name="categoryId" value={c.id} />
              <div style={{ padding: "4px 12px", fontWeight: 700 }}>{c.name}</div>
              <div className="chips">
                {dps.map((d) => <label key={d.id} className="chk" style={{ margin: 0 }}><input type="checkbox" name="daypartIds" value={d.id} defaultChecked={c.daypartIds.includes(d.id)} /> {d.name}</label>)}
                {!dps.length && <span className="muted small">Add a menu time first.</span>}
              </div>
              {dps.length > 0 && <div className="chips"><button className="on">Save {c.name}</button>{!c.daypartIds.length && <span className="muted small" style={{ alignSelf: "center" }}>Now: whenever you are open</span>}</div>}
            </form>
          ))}
        </>
      ) : tab === "86" ? (
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
                <div className="panel" key={i.id}>
                  <div style={{ padding: "10px 12px 2px" }}>{i.emoji} <b>{i.name}</b> · ${(i.basePriceCents / 100).toFixed(2)}{!i.isActive && <span className="kind" style={{ marginLeft: 6 }}>Hidden</span>}</div>
                  {/* photos right on the list: tap + Photos, pick from the phone or computer; the first is the cover */}
                  <ItemPhotos itemId={i.id} initial={i.images} />
                  <details>
                  <summary style={{ padding: "4px 12px 6px", cursor: "pointer", fontSize: 13 }} className="muted">Edit name, price, description</summary>
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
                </div>
              ))}
            </div>
          ))}
          <p className="note">Modifier groups (sizes, toppings, &quot;comes with&quot;) are shared across items; the full modifier editor is in the build plan.</p>
        </>
      )}
    </>
  );
}

function DaypartForm({ d }: { d?: { id: string; name: string; startsAt: string; endsAt: string; days: number[] } }) {
  return (
    <form action={saveDaypart}>
      <input type="hidden" name="id" value={d?.id ?? ""} />
      <label className="field"><span>Name</span><input name="name" defaultValue={d?.name} placeholder="Breakfast" required /></label>
      <div className="two">
        <label className="field"><span>Starts</span><input name="startsAt" type="time" defaultValue={d?.startsAt ?? "07:00"} required /></label>
        <label className="field"><span>Ends (earlier than start = after midnight)</span><input name="endsAt" type="time" defaultValue={d?.endsAt ?? "11:00"} required /></label>
      </div>
      <div className="chips">{DAYS.map((x, i) => <label key={x} className="chk" style={{ margin: 0 }}><input type="checkbox" name="days" value={i} defaultChecked={d ? d.days.includes(i) : true} /> {x}</label>)}</div>
      <div className="chips"><button className="on">{d ? "Save" : "Add menu time"}</button></div>
    </form>
  );
}
