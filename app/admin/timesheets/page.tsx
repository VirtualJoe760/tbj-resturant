import { and, gte, isNull, lt } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { addDays, mondayOf } from "@/db/seed";
import { restaurant } from "@/config/restaurant";
import { ApproveWeek } from "./ApproveWeek";

export const metadata = { title: "Timesheets" };

const hrs = (ms: number) => Math.round((ms / 36e5) * 10) / 10;

export default async function Timesheets() {
  const db = await getDb();
  const lastMon = addDays(mondayOf(), -7);
  const from = new Date(lastMon + "T00:00:00-07:00");
  const to = new Date(addDays(lastMon, 7) + "T00:00:00-07:00");
  const [emps, entries, open, shifts] = await Promise.all([
    db.select().from(s.employees),
    db.select().from(s.timeEntries).where(and(gte(s.timeEntries.clockInAt, from), lt(s.timeEntries.clockInAt, to))),
    db.select().from(s.timeEntries).where(isNull(s.timeEntries.clockOutAt)),
    db.select().from(s.shifts),
  ]);
  const rows = emps.map((e) => {
    const mine = entries.filter((t) => t.employeeId === e.id && t.clockOutAt);
    const worked = mine.reduce((a, t) => a + hrs(t.clockOutAt!.getTime() - t.clockInAt.getTime()), 0);
    const sched = shifts.filter((x) => x.employeeId === e.id && x.date >= lastMon && x.date < addDays(lastMon, 7)).length;
    const flags: string[] = [];
    if (worked > 40) flags.push(`${(worked - 40).toFixed(1)}h weekly overtime`);
    mine.forEach((t) => {
      const h = hrs(t.clockOutAt!.getTime() - t.clockInAt.getTime());
      if (h > 8) flags.push(`${t.clockInAt.toLocaleDateString("en-US", { weekday: "short", timeZone: restaurant.timezone })}: ${(h - 8).toFixed(1)}h daily OT`);
      if (h > 5 && t.breaks.length === 0) flags.push(`${t.clockInAt.toLocaleDateString("en-US", { weekday: "short", timeZone: restaurant.timezone })}: missed meal break`);
    });
    return { e, worked: Math.round(worked * 10) / 10, shiftsLastWeek: sched, flags, ids: mine.map((t) => t.id), approved: mine.length > 0 && mine.every((t) => t.approvedAt) };
  });
  return (
    <>
      <div className="admin-top"><b>Timesheets</b><a className="ibtn" href="/api/admin/timesheets.csv">Export CSV</a></div>
      <div className="sec">On the clock now</div>
      {open.length === 0 && <p className="note">Nobody is clocked in.</p>}
      {open.map((t) => {
        const e = emps.find((x) => x.id === t.employeeId);
        return <div className="mrow" key={t.id}><span style={{ color: "var(--ok)" }}>●</span><div className="grow"><b>{e?.name}</b><small>{e?.position} · since {t.clockInAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: restaurant.timezone })}{t.breaks.some((b) => !b.end) ? " · on break" : ""} · {t.locationVerified ? "📍 verified" : "location not checked"}</small></div></div>;
      })}
      <div className="sec">Last week · {lastMon}</div>
      {rows.map((r) => (
        <div className="mrow" key={r.e.id}>
          <div className="grow"><b>{r.e.name}</b><small>Worked {r.worked}h · ${(r.e.payRateCents / 100).toFixed(2)}/h{r.flags.length ? <span style={{ color: "var(--bad)" }}> · ⚠ {r.flags.join(" · ")}</span> : ""}</small></div>
          {r.approved && <span className="kind ok">Approved</span>}
        </div>
      ))}
      <ApproveWeek ids={rows.flatMap((r) => r.ids)} gusto={restaurant.features.payroll === "gusto"} />
      <p className="note">Overtime and break flags follow California rules as a guide. Confirm with your payroll provider.</p>
    </>
  );
}
