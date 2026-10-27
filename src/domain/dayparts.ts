// Menu times: breakfast, lunch, dinner, late night. A category served in one or more dayparts can
// only be ordered inside those windows; a category with none follows the store's opening hours.
import { formatTime, isOpenAt, localParts } from "./hours";

export interface Daypart {
  id: string;
  name: string;
  startsAt: string; // "07:00"
  endsAt: string; // "11:00"; <= startsAt runs past midnight
  days: number[]; // 0 = Sunday
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const rows = (d: Daypart) => d.days.map((weekday) => ({ weekday, opensAt: d.startsAt, closesAt: d.endsAt }));

export function daypartOpenAt(d: Daypart, weekday: number, minutes: number) {
  return isOpenAt(rows(d), weekday, minutes);
}

/** "Mon–Fri", "Sat & Sun", "Every day", or a plain list. */
export function daysLabel(days: number[]) {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Mon–Fri";
  if (set.join() === "0,6") return "Sat & Sun";
  return set.map((d) => DAYS[d]).join(", ");
}

/** "Breakfast · 7 AM – 11 AM" (+ days when not every day). */
export function daypartLabel(d: Daypart) {
  const days = daysLabel(d.days);
  return `${d.name} · ${formatTime(d.startsAt)} – ${formatTime(d.endsAt)}${days === "Every day" ? "" : ` · ${days}`}`;
}

export interface Availability {
  availableNow: boolean;
  /** Shown when the category is limited to menu times, e.g. "Breakfast · 7 AM – 11 AM". */
  label: string | null;
}

export function categoryAvailability(daypartIds: string[], dayparts: Daypart[], timeZone: string, now = new Date()): Availability {
  const mine = dayparts.filter((d) => daypartIds.includes(d.id));
  if (!mine.length) return { availableNow: true, label: null };
  const { weekday, minutes } = localParts(now, timeZone);
  return { availableNow: mine.some((d) => daypartOpenAt(d, weekday, minutes)), label: mine.map(daypartLabel).join(" or ") };
}

/** Names of the dayparts running right now, e.g. ["Lunch"]. */
export function servingNow(dayparts: Daypart[], timeZone: string, now = new Date()) {
  const { weekday, minutes } = localParts(now, timeZone);
  return dayparts.filter((d) => daypartOpenAt(d, weekday, minutes)).map((d) => d.name);
}

/** Common defaults, used when an imported menu has sections with these names. */
export const DEFAULT_DAYPARTS: { match: RegExp; name: string; startsAt: string; endsAt: string }[] = [
  { match: /breakfast|brunch|morning/i, name: "Breakfast", startsAt: "07:00", endsAt: "11:00" },
  { match: /lunch/i, name: "Lunch", startsAt: "11:00", endsAt: "15:00" },
  { match: /dinner|supper|evening/i, name: "Dinner", startsAt: "16:00", endsAt: "22:00" },
  { match: /late\s*night|after\s*hours/i, name: "Late night", startsAt: "22:00", endsAt: "02:00" },
];
