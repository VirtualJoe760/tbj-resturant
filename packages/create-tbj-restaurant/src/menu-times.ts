// Breakfast / lunch / dinner: which menu sections are served when. Guessed from section names,
// confirmed in the questionnaire, loaded into the app's dayparts table by import-client.
import type { MenuTime } from "./types.ts";

export const PRESETS: { name: string; match: RegExp; startsAt: string; endsAt: string }[] = [
  { name: "Breakfast", match: /breakfast|morning/i, startsAt: "07:00", endsAt: "11:00" },
  { name: "Brunch", match: /brunch/i, startsAt: "09:00", endsAt: "14:00" },
  { name: "Lunch", match: /lunch/i, startsAt: "11:00", endsAt: "15:00" },
  { name: "Dinner", match: /dinner|supper|evening/i, startsAt: "16:00", endsAt: "22:00" },
  { name: "Late night", match: /late\s*night|after\s*hours/i, startsAt: "22:00", endsAt: "02:00" },
];

/** Menu times implied by section names, e.g. a "Breakfast" section → Breakfast 7–11. */
export function guessMenuTimes(sections: string[]): MenuTime[] {
  return PRESETS.map((p) => ({ name: p.name, startsAt: p.startsAt, endsAt: p.endsAt, sections: sections.filter((s) => p.match.test(s)) })).filter((t) => t.sections.length);
}

const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/**
 * "7-11", "11-3", "5-10", "7am-11am", "4:30pm - 10pm", "10pm-2am", "22:00-02:00" → ["HH:MM", "HH:MM"].
 * Without am/pm, a restaurant's day is assumed: 6–11 are mornings, 12 is noon, 1–5 are afternoons,
 * and an end that would come before the start moves to the evening. null if unreadable.
 */
export function parseRange(text: string): [string, string] | null {
  const m = text.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2] ?? 0), Number(m[4]), Number(m[5] ?? 0)];
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  if (h1 > 12 || h2 > 12 || h1 === 0 || h2 === 0) return [hhmm(h1, m1), hhmm(h2, m2)]; // 24-hour clock
  const withAp = (h: number, ap: string) => (h % 12) + (ap.startsWith("p") ? 12 : 0);
  const guess = (h: number) => (h === 12 ? 12 : h <= 5 ? h + 12 : h);
  const start = m[3] ? withAp(h1, m[3]) : guess(h1);
  let end = m[6] ? withAp(h2, m[6]) : guess(h2);
  if (!m[6] && end * 60 + m2 <= start * 60 + m1 && end < 12) end += 12;
  return [hhmm(start, m1), hhmm(end % 24, m2)];
}
