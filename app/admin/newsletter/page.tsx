import { desc, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { sendCampaign } from "@/server/actions/admin";
import { getUpcomingEvents } from "@/server/queries";
import { dayLabel } from "@/domain/events";

export const metadata = { title: "Newsletter" };

export default async function Newsletter() {
  const db = await getDb();
  const [[{ n }], campaigns, events] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(s.subscribers),
    db.select().from(s.campaigns).orderBy(desc(s.campaigns.createdAt)),
    getUpcomingEvents(14),
  ]);
  const draft = `This week at The Hood:\n\n${events.slice(0, 4).map((e) => { const d = dayLabel(e.on); return `${d.dow} ${d.month} ${d.day} — ${e.title}`; }).join("\n")}\n\nOrder ahead anytime on our site. See you soon!`;
  return (
    <>
      <div className="admin-top"><b>Newsletter</b><span className="muted small">{n} subscribers</span></div>
      <form action={sendCampaign} className="panel">
        <label className="field"><span>Subject</span><input name="subject" required defaultValue="This week: bingo, karaoke & live music 🎸" /></label>
        <label className="field"><span>Message (blank line = new paragraph)</span><textarea name="body" rows={9} defaultValue={draft} /></label>
        <div className="chips"><button className="on">Send to {n} subscribers</button></div>
        <p className="note">Demo sites put every email in the Demo inbox instead of sending it.</p>
      </form>
      <div className="sec">Sent</div>
      {campaigns.length === 0 && <p className="note">No campaigns yet.</p>}
      {campaigns.map((c) => <div className="mrow" key={c.id}><div className="grow"><b>{c.subject}</b><small>{c.sentAt?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {c.sentCount} recipients</small></div><span className="kind ok">{c.status}</span></div>)}
    </>
  );
}
