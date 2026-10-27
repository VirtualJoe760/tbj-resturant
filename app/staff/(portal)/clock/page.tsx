import { and, desc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { restaurant } from "@/config/restaurant";
import { todayLocal } from "@/server/queries";
import { getStaffContext, short } from "@/server/staff-data";
import { ClockClient } from "./ClockClient";

export const metadata = { title: "Time clock" };

export default async function ClockPage() {
  const { me, shifts } = await getStaffContext();
  const db = await getDb();
  const entries = await db.select().from(s.timeEntries).where(and(eq(s.timeEntries.employeeId, me.id))).orderBy(desc(s.timeEntries.clockInAt)).limit(8);
  const open = entries.find((e) => !e.clockOutAt);
  const state = !open ? "off" : open.breaks.some((b) => !b.end) ? "on_break" : "on";
  const todays = shifts.find((x) => x.employeeId === me.id && x.date === todayLocal());
  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: restaurant.timezone });
  return (
    <>
      <header className="top"><h1>Time clock</h1><p>{todays ? `Today's shift: ${short(todays.start)} – ${short(todays.end)} · ${todays.position}` : "No shift scheduled today"}</p></header>
      <ClockClient state={state} since={open ? fmt(open.clockInAt) : null} place={restaurant.shortName} />
      <div className="sec">Recent</div>
      {entries.filter((e) => e.clockOutAt).map((e) => (
        <div className="dayrow" key={e.id}>
          <span className="d" style={{ width: "auto" }}>{e.clockInAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: restaurant.timezone })}</span>
          <span style={{ flex: 1, textAlign: "right" }}>{fmt(e.clockInAt)} – {fmt(e.clockOutAt!)}</span>
          <b>{((e.clockOutAt!.getTime() - e.clockInAt.getTime()) / 36e5).toFixed(1)}h</b>
        </div>
      ))}
      <p className="note">Forgot to clock in or out? Tell your manager — they can fix it on the timesheet.</p>
    </>
  );
}
