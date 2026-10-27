// Opening hours, including bars that close after midnight (2 PM – 2 AM).
// closesAt <= opensAt means the period ends the NEXT day.

export interface HoursRow {
  weekday: number; // 0 = Sunday
  opensAt: string; // "14:00"
  closesAt: string; // "02:00"
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Local wall-clock parts for a timezone. */
export function localParts(now: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Is the location open at local (weekday, minutes)? */
export function isOpenAt(rows: HoursRow[], weekday: number, minutes: number): boolean {
  for (const r of rows) {
    const o = toMin(r.opensAt);
    const c = toMin(r.closesAt);
    const overnight = c <= o;
    if (r.weekday === weekday && minutes >= o && (overnight || minutes < c)) return true;
    // spill-over from yesterday's overnight period
    if (overnight && r.weekday === (weekday + 6) % 7 && minutes < c) return true;
  }
  return false;
}

export function isOpenNow(rows: HoursRow[], timeZone: string, now = new Date()) {
  const { weekday, minutes } = localParts(now, timeZone);
  return isOpenAt(rows, weekday, minutes);
}

export function formatTime(t: string) {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${m ? ":" + String(m).padStart(2, "0") : ""} ${ap}`;
}

/** "Every day 2 PM – 2 AM" style summary when all days match, else per-day lines. */
export function summarizeHours(rows: HoursRow[]): string[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const label = (r: HoursRow) => `${formatTime(r.opensAt)} – ${formatTime(r.closesAt)}`;
  const byDay = days.map((_, d) => rows.filter((r) => r.weekday === d).map(label).join(", ") || "Closed");
  if (byDay.every((x) => x === byDay[0])) return [`Every day ${byDay[0]}`];
  return days.map((d, i) => `${d} ${byDay[i]}`);
}
