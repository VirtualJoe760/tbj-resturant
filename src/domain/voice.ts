// Turns what a caller says about one item into modifier selections.
// "large OG combo, hold the sausage, add onions, extra cheese, mushrooms on half"

import { defaultSelections, type ItemDef, type Selections } from "./pricing";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const singular = (w: string) => w.replace(/(es|s)$/, "");
const ALIASES: Record<string, string[]> = { mozzarella: ["cheese", "mozz"], "green peppers": ["peppers", "bell peppers"], "jumbo slice": ["slice"], "whole pie": ["whole", "large", "whole pizza", "pie"] };

function matches(phrase: string, name: string) {
  const n = norm(name).replace(/\(.*\)/, "").trim();
  const words = [n, ...(ALIASES[n] ?? []), ...(ALIASES[norm(name)] ?? [])];
  const p = norm(phrase);
  return words.some((w) => p === w || singular(p) === singular(w) || p.includes(w) || (p.length > 3 && w.startsWith(p)));
}

export interface ParseResult {
  selections: Selections;
  unmatched: string[];
  ambiguous: { phrase: string; options: string[] }[];
}

/** Applies spoken instructions on top of the item's defaults. */
export function parseSpokenModifiers(item: ItemDef, speech: string): ParseResult {
  const sel = defaultSelections(item);
  const unmatched: string[] = [];
  const ambiguous: ParseResult["ambiguous"] = [];
  const clauses = speech.split(/,|;|\band\b|\bwith\b|\bplus\b|\bbut\b/i).map(norm).filter(Boolean);

  for (const clause of clauses) {
    let action = "choose" as "remove" | "add" | "extra" | "light" | "choose";
    let rest = clause;
    const take = (re: RegExp, a: typeof action) => {
      if (re.test(rest)) {
        action = a;
        rest = rest.replace(re, "").trim();
      }
    };
    take(/^(hold the|hold|no|without|remove|take off the|take off)\s+/, "remove");
    take(/^(add|put|and)\s+/, "add");
    take(/^(extra|double|lots of)\s+/, "extra");
    take(/^(light|easy on the|easy)\s+/, "light");
    let place: "whole" | "left" | "right" = "whole";
    if (/ on (half|one half|the left|left half)$/.test(rest)) { place = "left"; rest = rest.replace(/ on (half|one half|the left|left half)$/, ""); }
    if (/ on (the right|right half|other half)$/.test(rest)) { place = "right"; rest = rest.replace(/ on (the right|right half|other half)$/, ""); }
    if (!rest) continue;

    const hits = item.groups.flatMap((g) => g.mods.filter((m) => matches(rest, m.name)).map((m) => ({ g, m })));
    if (!hits.length) { unmatched.push(clause); continue; }
    // prefer an exact-name hit, then the group that fits the action
    const exact = hits.filter((h) => norm(h.m.name) === rest || singular(norm(h.m.name)) === singular(rest));
    const pool = exact.length ? exact : hits;
    const fit = pool.filter((h) => (action === "remove" ? h.g.kind === "removal" : action === "add" ? h.g.kind === "addon" : true));
    const pick = (fit.length ? fit : pool);
    const names = [...new Set(pick.map((h) => h.m.name))];
    if (names.length > 1) { ambiguous.push({ phrase: rest, options: names }); continue; }
    const { g, m } = pick[0];

    if (g.kind === "choice" || g.kind === "option") {
      for (const o of g.mods) delete sel[o.id];
      sel[m.id] = { action: "choose" };
    } else if (g.kind === "removal") {
      sel[m.id] = action === "remove" ? { action: "remove" } : { action: "keep", qty: action === "extra" ? "extra" : action === "light" ? "light" : "normal" };
    } else if (action === "remove") delete sel[m.id];
    else sel[m.id] = { action: "add", qty: action === "extra" ? "extra" : action === "light" ? "light" : "normal", place };
  }
  return { selections: sel, unmatched, ambiguous };
}

/** "$29.50" → "twenty-nine fifty" style is left to the voice; we give a clean "29 dollars and 50 cents". */
export const speakMoney = (cents: number) => {
  const d = Math.floor(cents / 100);
  const c = cents % 100;
  return c ? `${d} dollars and ${c} cents` : `${d} dollars`;
};
