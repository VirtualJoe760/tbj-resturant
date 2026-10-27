// No AI key? Read simple pasted menus: category lines, then "Item name ... $9.95 - description".
import type { Menu } from "../types.ts";

export function parsePlainMenu(text: string): Menu {
  const categories: Menu["categories"] = [];
  let cur: Menu["categories"][number] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?)\s*(?:\.{2,}|-|–|:)?\s*\$\s?(\d+(?:\.\d{1,2})?)\s*(?:[-–—]\s*(.*))?$/);
    if (!m) {
      cur = { name: line.replace(/[:#*]+/g, "").trim(), items: [] };
      categories.push(cur);
      continue;
    }
    if (!cur) {
      cur = { name: "Menu", items: [] };
      categories.push(cur);
    }
    const name = m[1].trim();
    const alcohol = /beer|wine|seltzer|cocktail|margarita|ipa|lager/i.test(name + " " + cur.name);
    cur.items.push({ name, description: (m[3] ?? "").trim(), price_cents: Math.round(Number(m[2]) * 100), orderable_online: !alcohol, tags: alcohol ? ["21+"] : [], modifier_groups: [] });
  }
  return { categories: categories.filter((c) => c.items.length), guesses: ["Modifiers not set — add sizes and toppings in admin"] };
}
