import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { dayLabel, repeatLabel } from "@/domain/events";
import { formatTime } from "@/domain/hours";
import { deleteEvent, saveEvent, toggleEventHome } from "@/server/actions/admin";
import { todayLocal } from "@/server/queries";

export const metadata = { title: "Events" };

export default async function AdminEvents() {
  const db = await getDb();
  const [events, forms] = await Promise.all([
    db.select().from(s.events).orderBy(asc(s.events.date)),
    db.select({ slug: s.pages.slug, title: s.pages.title }).from(s.pages).where(eq(s.pages.kind, "form")),
  ]);
  return (
    <>
      <div className="admin-top"><b>Events</b><span className="muted small">{events.length} on the calendar</span></div>
      <details className="panel" open={events.length === 0}>
        <summary style={{ padding: "12px", cursor: "pointer", fontWeight: 700 }}>+ Add event</summary>
        <form action={saveEvent}>
          <label className="field"><span>Event name *</span><input name="title" required placeholder="e.g. 🎸 Live Music: The Desert Sons" /></label>
          <div className="two">
            <label className="field"><span>Date *</span><input type="date" name="date" required defaultValue={todayLocal()} /></label>
            <label className="field"><span>Start time</span><input type="time" name="startTime" defaultValue="21:00" /></label>
          </div>
          <div className="two">
            <label className="field"><span>Repeats</span><select name="repeat"><option value="">Does not repeat</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
            <label className="field"><span>Type</span><select name="category">{["Live music", "Bingo", "Karaoke", "Sports", "Trivia", "Other"].map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <label className="field"><span>Short description</span><input name="description" placeholder="Shown under the title" /></label>
          <label className="field"><span>Button links to</span><select name="linkPageSlug"><option value="">No button</option>{forms.map((f) => <option key={f.slug} value={f.slug}>Form: {f.title}</option>)}</select></label>
          <label className="chk"><input type="checkbox" name="showOnHome" defaultChecked /> Show on home page</label>
          <label className="chk"><input type="checkbox" name="newsletter" /> Add to next newsletter</label>
          <div className="chips"><button className="on">Save event</button></div>
        </form>
      </details>
      <div className="sec">Calendar</div>
      {events.map((e) => {
        const d = dayLabel(e.date);
        return (
          <div className="ev" key={e.id}>
            <div className="date"><small>{d.dow}</small><b>{d.day}</b></div>
            <div className="grow">
              <b>{e.title}</b>
              <div className="mods">{d.month} {d.day} · {formatTime(e.startTime ?? "20:00")}{repeatLabel(e) ? ` · ${repeatLabel(e)}` : ""} · {e.category}</div>
            </div>
            <form action={toggleEventHome.bind(null, e.id, !e.showOnHome)}><button className={`switch ${e.showOnHome ? "" : "off"}`} title="Show on home page" aria-label="Show on home page" /></form>
            <form action={deleteEvent.bind(null, e.id)}><button className="ibtn danger" aria-label="Delete">✕</button></form>
          </div>
        );
      })}
      <p className="note">Switch = show on the home page. Weekly events repeat automatically.</p>
    </>
  );
}
