import "server-only";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { mondayOf } from "@/db/seed";

/** The signed-in employee plus this week's published shifts and open cover requests. */
export async function getStaffContext() {
  const u = await getUser();
  const db = await getDb();
  const me = u ? await db.query.employees.findFirst({ where: eq(s.employees.userId, u.id) }) : null;
  if (!me) redirect("/account");
  const weekStart = mondayOf();
  const [team, shifts, sched, covers, timeOff] = await Promise.all([
    db.select().from(s.employees),
    db.select().from(s.shifts).where(eq(s.shifts.weekStart, weekStart)),
    db.query.schedules.findFirst({ where: eq(s.schedules.weekStart, weekStart) }),
    db.select().from(s.shiftCoverRequests).where(inArray(s.shiftCoverRequests.status, ["open", "claimed", "approved"])),
    db.select().from(s.timeOffRequests),
  ]);
  return { me, team, shifts, published: !!sched?.publishedAt, weekStart, covers, timeOff };
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const short = (t: string) => {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
};
