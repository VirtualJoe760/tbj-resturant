"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { getUser } from "@/auth/session";
import { clockNext, metersBetween, type ClockState } from "@/domain/scheduling";
import { restaurant } from "@/config/restaurant";

const GEOFENCE_M = 150;

export async function myEmployee() {
  const u = await getUser();
  if (!u) throw new Error("Sign in first");
  const db = await getDb();
  const e = await db.query.employees.findFirst({ where: eq(s.employees.userId, u.id) });
  if (!e) throw new Error("No staff profile for this account");
  return e;
}

async function openEntry(employeeId: string) {
  const db = await getDb();
  return db.query.timeEntries.findFirst({ where: and(eq(s.timeEntries.employeeId, employeeId), isNull(s.timeEntries.clockOutAt)) });
}

export async function clockState(): Promise<ClockState> {
  const e = await myEmployee();
  const open = await openEntry(e.id);
  if (!open) return "off";
  return open.breaks.some((b) => !b.end) ? "on_break" : "on";
}

/**
 * Clock actions. `pos` comes from the phone's location; in demo mode a missing location is
 * allowed (laptops, desktop browsers) and recorded as unverified.
 */
export async function clock(action: "in" | "out" | "break_start" | "break_end", pos?: { lat: number; lng: number } | null) {
  const e = await myEmployee();
  const db = await getDb();
  const state = await clockState();
  let next: ClockState;
  try {
    next = clockNext(state, action);
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  const now = new Date();
  if (action === "in") {
    const dist = pos ? metersBetween(pos, restaurant.location) : null;
    if (dist !== null && dist > GEOFENCE_M && process.env.APP_MODE === "live")
      return { ok: false, message: `You're ${Math.round(dist)} m from ${restaurant.shortName}. Ask a manager to approve.` };
    await db.insert(s.timeEntries).values({ employeeId: e.id, clockInAt: now, locationVerified: dist !== null && dist <= GEOFENCE_M });
  } else {
    const open = (await openEntry(e.id))!;
    let breaks = open.breaks;
    if (action === "break_start") breaks = [...breaks, { start: now.toISOString() }];
    if (action === "break_end" || action === "out") breaks = breaks.map((b) => (b.end ? b : { ...b, end: now.toISOString() }));
    await db.update(s.timeEntries).set({ breaks, ...(action === "out" ? { clockOutAt: now } : {}) }).where(eq(s.timeEntries.id, open.id));
  }
  revalidatePath("/staff/clock");
  revalidatePath("/admin/timesheets");
  const msg = { in: "Clocked in", out: "Clocked out — nice work", break_start: "Break started", break_end: "Back from break" }[action];
  return { ok: true, message: msg, state: next };
}

export async function saveAvailability(form: FormData) {
  const e = await myEmployee();
  const db = await getDb();
  const avail = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const v = String(form.get(`d${i}`));
    return ["prefer", "ok", "no"].includes(v) ? v : "ok";
  });
  await db.update(s.employees).set({
    avail, preferredWindow: String(form.get("window") ?? "Either"),
    maxHoursWeek: Math.max(0, Math.min(60, Number(form.get("max")) || e.maxHoursWeek)), note: String(form.get("note") ?? "").slice(0, 300),
  }).where(eq(s.employees.id, e.id));
  revalidatePath("/staff/availability");
  revalidatePath("/admin/schedule");
}

export async function requestTimeOff(form: FormData) {
  const e = await myEmployee();
  const db = await getDb();
  const from = String(form.get("from"));
  const to = String(form.get("to") || from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || to < from) return;
  await db.insert(s.timeOffRequests).values({ employeeId: e.id, startsOn: from, endsOn: to, reason: String(form.get("reason") ?? "").slice(0, 200) });
  revalidatePath("/staff/availability");
  revalidatePath("/admin/schedule");
}

export async function askCover(shiftId: string, note = "") {
  const e = await myEmployee();
  const db = await getDb();
  const sh = await db.query.shifts.findFirst({ where: eq(s.shifts.id, shiftId) });
  if (!sh || sh.employeeId !== e.id) return;
  await db.insert(s.shiftCoverRequests).values({ shiftId, fromEmployeeId: e.id, note: note.slice(0, 200) });
  revalidatePath("/staff/cover");
  revalidatePath("/admin/schedule");
}

export async function claimCover(requestId: string) {
  const e = await myEmployee();
  const db = await getDb();
  const c = await db.query.shiftCoverRequests.findFirst({ where: eq(s.shiftCoverRequests.id, requestId) });
  if (!c || c.status !== "open" || c.fromEmployeeId === e.id) return;
  const sh = await db.query.shifts.findFirst({ where: eq(s.shifts.id, c.shiftId) });
  if (!sh || sh.position !== e.position) return;
  await db.update(s.shiftCoverRequests).set({ status: "claimed", claimedByEmployeeId: e.id }).where(eq(s.shiftCoverRequests.id, requestId));
  revalidatePath("/staff/cover");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function cancelCover(requestId: string) {
  const e = await myEmployee();
  const db = await getDb();
  await db.update(s.shiftCoverRequests).set({ status: "cancelled" })
    .where(and(eq(s.shiftCoverRequests.id, requestId), eq(s.shiftCoverRequests.fromEmployeeId, e.id)));
  revalidatePath("/staff/cover");
  revalidatePath("/admin/schedule");
}
