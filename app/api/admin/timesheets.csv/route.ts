import { desc } from "drizzle-orm";
import { ADMIN_ROLES, getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";

// Payroll export (Gusto / ADP / QuickBooks can all import this column layout).
export async function GET() {
  const u = await getUser();
  if (!u || !ADMIN_ROLES.includes(u.role)) return new Response("unauthorized", { status: 401 });
  const db = await getDb();
  const [emps, entries] = await Promise.all([db.select().from(s.employees), db.select().from(s.timeEntries).orderBy(desc(s.timeEntries.clockInAt))]);
  const rows = [["employee", "position", "clock_in", "clock_out", "hours", "break_minutes", "location_verified", "approved"]];
  for (const t of entries) {
    const e = emps.find((x) => x.id === t.employeeId);
    const breakMin = t.breaks.reduce((a, b) => a + (b.end ? (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000 : 0), 0);
    const hours = t.clockOutAt ? ((t.clockOutAt.getTime() - t.clockInAt.getTime()) / 36e5 - breakMin / 60).toFixed(2) : "";
    rows.push([e?.name ?? "", e?.position ?? "", t.clockInAt.toISOString(), t.clockOutAt?.toISOString() ?? "", hours, String(Math.round(breakMin)), String(t.locationVerified), t.approvedAt ? "yes" : "no"]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=timesheets.csv" } });
}
