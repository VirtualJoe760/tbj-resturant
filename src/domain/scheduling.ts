// Schedule warnings. The same checks run in the builder (live) and when publishing.
// Shift times are "HH:MM" on a given date; an end <= start means it ends after midnight.

export type AvailState = "prefer" | "ok" | "no";

export interface ShiftLike {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD (local)
  start: string; // "18:00"
  end: string; // "02:00"
}

export interface EmployeeLike {
  id: string;
  name: string;
  maxHoursWeek: number;
  avail: AvailState[]; // index 0 = Monday … 6 = Sunday
}

export interface TimeOffLike {
  employeeId: string;
  startsOn: string;
  endsOn: string;
  status: "pending" | "approved" | "denied";
}

export interface LaborRules {
  dailyOvertimeHours: number; // CA: 8
  weeklyOvertimeHours: number; // 40
}

export const CA_RULES: LaborRules = { dailyOvertimeHours: 8, weeklyOvertimeHours: 40 };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function shiftSpan(s: Pick<ShiftLike, "start" | "end">): [number, number] {
  const a = toMin(s.start);
  let b = toMin(s.end);
  if (b <= a) b += 1440;
  return [a, b];
}

export const shiftHours = (s: Pick<ShiftLike, "start" | "end">) => {
  const [a, b] = shiftSpan(s);
  return (b - a) / 60;
};

/** Monday-based weekday index for a YYYY-MM-DD date. */
export function mondayIndex(date: string) {
  const d = new Date(date + "T12:00:00Z").getUTCDay(); // 0 = Sun
  return (d + 6) % 7;
}

const WEEKDAY = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

export function shiftWarnings(
  shift: ShiftLike,
  ctx: { employee: EmployeeLike; weekShifts: ShiftLike[]; timeOff: TimeOffLike[]; rules?: LaborRules },
): string[] {
  const { employee: e, rules = CA_RULES } = ctx;
  const first = e.name.split(" ")[0];
  const w: string[] = [];
  const others = ctx.weekShifts.filter((s) => s.employeeId === e.id && (shift.id ? s.id !== shift.id : s !== shift));

  if (e.avail[mondayIndex(shift.date)] === "no") w.push(`${first} can't work ${WEEKDAY[mondayIndex(shift.date)]}`);

  const off = ctx.timeOff.find(
    (t) => t.employeeId === e.id && t.status !== "denied" && t.startsOn <= shift.date && shift.date <= t.endsOn,
  );
  if (off) w.push(`${first} has time off ${off.status} that day`);

  const [a, b] = shiftSpan(shift);
  if (others.some((s) => s.date === shift.date && (() => { const [c, d] = shiftSpan(s); return a < d && c < b; })()))
    w.push("Overlaps another shift");

  const hrs = shiftHours(shift);
  if (hrs > rules.dailyOvertimeHours) w.push(`${hrs}h shift — daily overtime after ${rules.dailyOvertimeHours}h`);

  const total = others.reduce((x, s) => x + shiftHours(s), 0) + hrs;
  if (total > rules.weeklyOvertimeHours) w.push(`${total}h this week — weekly overtime after ${rules.weeklyOvertimeHours}h`);
  else if (total > e.maxHoursWeek) w.push(`${total}h this week — over ${first}'s max of ${e.maxHoursWeek}h`);
  return w;
}

/** Clock state machine: off → on → on_break → on → off. */
export type ClockState = "off" | "on" | "on_break";
export function clockNext(state: ClockState, action: "in" | "out" | "break_start" | "break_end"): ClockState {
  const t: Record<string, ClockState> = {
    "off:in": "on",
    "on:break_start": "on_break",
    "on_break:break_end": "on",
    "on:out": "off",
    "on_break:out": "off",
  };
  const next = t[`${state}:${action}`];
  if (!next) throw new Error(`Can't ${action.replace("_", " ")} while ${state.replace("_", " ")}`);
  return next;
}

/** Distance in meters between two lat/lng points (geofence check). */
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
