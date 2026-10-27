// Expands weekly / monthly events into dated occurrences.

export interface EventLike {
  id: string;
  date: string; // first occurrence YYYY-MM-DD
  repeat: "" | "weekly" | "monthly";
  cancelledDates: string[];
}

const add = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonth = (date: string) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

export function occurrences<T extends EventLike>(events: T[], from: string, days: number): (T & { on: string })[] {
  const to = add(from, days);
  const out: (T & { on: string })[] = [];
  for (const e of events) {
    let d = e.date;
    let guard = 0;
    while (d <= to && guard++ < 400) {
      if (d >= from && !e.cancelledDates.includes(d)) out.push({ ...e, on: d });
      if (!e.repeat) break;
      d = e.repeat === "weekly" ? add(d, 7) : addMonth(d);
    }
  }
  return out.sort((a, b) => a.on.localeCompare(b.on));
}

export function dayLabel(date: string) {
  const d = new Date(date + "T12:00:00Z");
  return {
    dow: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getUTCDay()],
    day: d.getUTCDate(),
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()],
  };
}

export const repeatLabel = (e: EventLike) => {
  if (e.repeat === "monthly") return "Monthly";
  if (e.repeat !== "weekly") return "";
  const dow = dayLabel(e.date).dow;
  return "Every " + dow[0] + dow.slice(1).toLowerCase();
};
