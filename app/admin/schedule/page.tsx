import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { addDays, mondayOf } from "@/db/seed";
import { ScheduleClient } from "./ScheduleClient";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : mondayOf();
  const db = await getDb();
  const [employees, shifts, timeOff, sched, covers] = await Promise.all([
    db.select().from(s.employees).where(eq(s.employees.status, "active")),
    db.select().from(s.shifts).where(eq(s.shifts.weekStart, weekStart)),
    db.select().from(s.timeOffRequests),
    db.query.schedules.findFirst({ where: eq(s.schedules.weekStart, weekStart) }),
    db.select().from(s.shiftCoverRequests).where(inArray(s.shiftCoverRequests.status, ["open", "claimed"])),
  ]);
  return (
    <>
      <div className="admin-top">
        <b>Schedule</b>
        <div className="actions">
          <span className={`kind ${sched?.status === "published" ? "ok" : "new"}`}>{!sched ? "Not started" : sched.status === "published" ? "Published" : "Unpublished changes"}</span>
          <Link className="ibtn" href="/admin/timesheets">Timesheets</Link>
        </div>
      </div>
      <div className="chips" style={{ alignItems: "center" }}>
        <Link href={`/admin/schedule?week=${addDays(weekStart, -7)}`}>‹ Prev</Link>
        <b style={{ fontSize: 14 }}>Week of {new Date(weekStart + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>
        <Link href={`/admin/schedule?week=${addDays(weekStart, 7)}`}>Next ›</Link>
      </div>
      <ScheduleClient
        weekStart={weekStart}
        employees={employees.map((e) => ({ id: e.id, name: e.name, position: e.position, maxHoursWeek: e.maxHoursWeek, avail: e.avail as ("prefer" | "ok" | "no")[], payRateCents: e.payRateCents, preferredWindow: e.preferredWindow, note: e.note }))}
        shifts={shifts.map((x) => ({ id: x.id, employeeId: x.employeeId, date: x.date, start: x.start, end: x.end, position: x.position }))}
        timeOff={timeOff.map((t) => ({ id: t.id, employeeId: t.employeeId, startsOn: t.startsOn, endsOn: t.endsOn, status: t.status, reason: t.reason }))}
        covers={covers.map((c) => ({ id: c.id, shiftId: c.shiftId, from: c.fromEmployeeId, by: c.claimedByEmployeeId, status: c.status, note: c.note }))}
      />
    </>
  );
}
