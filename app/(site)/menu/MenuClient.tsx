"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cart, useCart } from "@/components/cart-store";
import { toast } from "@/components/Toast";
import { describeSelections, validateSelections } from "@/domain/cart";
import { defaultSelections, money, priceLine, type GroupDef, type Selections } from "@/domain/pricing";
import type { MenuCategory, MenuItemView } from "@/server/queries";

export function MenuClient({ menu, openItem }: { menu: MenuCategory[]; openItem?: string }) {
  const all = menu.flatMap((c) => c.items);
  const [cur, setCur] = useState<MenuItemView | null>(() => all.find((i) => i.id === openItem && !i.soldOut && i.orderableOnline) ?? null);
  const lines = useCart();
  const count = lines.reduce((a, l) => a + l.quantity, 0);
  const total = lines.reduce((a, l) => a + l.unitCents * l.quantity, 0);

  return (
    <div className="has-bar">
      <nav className="cat-tabs">
        {menu.map((c) => <a key={c.id} href={`#cat-${c.id}`}>{c.name}</a>)}
      </nav>
      {menu.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} style={{ scrollMarginTop: 56 }}>
          <div className="sec">{c.name}</div>
          <div className="menu-grid">
            {c.items.map((i) => {
              const off = i.soldOut || !i.orderableOnline;
              return (
                <button key={i.id} className={`item ${i.soldOut ? "sold" : ""}`} disabled={off} onClick={() => setCur(i)}>
                  <div className="em">{i.emoji}</div>
                  <div className="grow">
                    <b>{i.name}</b>
                    <div className="mods">{i.description}</div>
                    <div style={{ marginTop: 4 }}>
                      {i.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                      {i.soldOut && <span className="kind new">Sold out today</span>}
                      {!i.orderableOnline && <span className="kind">Dine-in only</span>}
                    </div>
                  </div>
                  <div className="price">{money(i.basePriceCents)}</div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {count > 0 && (
        <div className="bar">
          <Link className="btn" href="/cart"><span>View order · {count}</span><span>{money(total)}</span></Link>
        </div>
      )}
      {cur && <ItemSheet item={cur} onClose={() => setCur(null)} />}
    </div>
  );
}

function ItemSheet({ item, onClose }: { item: MenuItemView; onClose: () => void }) {
  const def = item.def;
  const [sel, setSel] = useState<Selections>(() => defaultSelections(def));
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const unit = useMemo(() => priceLine(def, sel), [def, sel]);
  const v = validateSelections(def, sel);
  const wholePie = Object.keys(sel).includes("whole");

  const toggle = (g: GroupDef, mid: string) => {
    const next = { ...sel };
    if (g.kind === "removal") next[mid] = { action: next[mid]?.action === "remove" ? "keep" : "remove", qty: "normal" };
    else if (g.max === 1) {
      for (const m of g.mods) delete next[m.id];
      next[mid] = { action: "choose" };
      if (g.id === "size" && mid !== "whole") for (const k in next) if (next[k].place && next[k].place !== "whole") next[k] = { ...next[k], place: "whole" };
    } else if (next[mid]) delete next[mid];
    else next[mid] = { action: "add", qty: "normal", place: "whole" };
    setSel(next);
  };
  const setOpt = (mid: string, k: "qty" | "place", val: string) => setSel({ ...sel, [mid]: { ...sel[mid], [k]: val } });

  const add = () => {
    cart.add({ itemId: def.id, name: def.name, emoji: item.emoji, quantity: qty, unitCents: unit, selections: sel, modifiers: describeSelections(def, sel).map((d) => d.label), instructions: notes || undefined });
    toast(`Added ${qty}× ${def.name}`);
    onClose();
  };

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={def.name}>
        <div className="head">
          <div>
            <div style={{ fontSize: 13 }}>{item.emoji} {item.tags.join(" · ")}</div>
            <b style={{ fontSize: 20 }}>{def.name}</b>
            <div className="mods">{item.description}</div>
          </div>
          <button className="ibtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {def.groups.map((g) => {
          const rule = g.kind === "removal" ? "Uncheck to remove" : g.min ? "Required · choose 1" : `Up to ${g.max}`;
          return (
            <div key={g.id}>
              <div className="sec">{g.name} <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>{rule}</span></div>
              {g.mods.map((m) => {
                const s = sel[m.id];
                const on = g.kind === "removal" ? s?.action !== "remove" : !!s;
                const price = g.kind === "removal" ? "" : m.priceCents ? "+" + money(m.priceCents) : "";
                return (
                  <div className="opt" key={m.id}>
                    <label>
                      <input type={g.kind !== "removal" && g.max === 1 ? "radio" : "checkbox"} name={g.id} checked={on} onChange={() => toggle(g, m.id)} />
                      <span className={g.kind === "removal" && !on ? "removed" : ""}>{m.name}</span>
                    </label>
                    {on && g.kind === "addon" && (
                      <span style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Seg value={s!.qty ?? "normal"} options={[["light", "Light"], ["normal", "Reg"], ["extra", "Extra"]]} onChange={(x) => setOpt(m.id, "qty", x)} />
                        {wholePie && <Seg value={s!.place ?? "whole"} options={[["left", "L½"], ["whole", "All"], ["right", "R½"]]} onChange={(x) => setOpt(m.id, "place", x)} />}
                      </span>
                    )}
                    {on && g.kind === "removal" && m.extraPriceCents ? (
                      <Seg value={s?.qty === "extra" ? "extra" : "normal"} options={[["normal", "Reg"], ["extra", `Extra +${money(m.extraPriceCents)}`]]} onChange={(x) => setOpt(m.id, "qty", x)} />
                    ) : null}
                    <span className="muted" style={{ fontSize: 13 }}>{price}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
        <label className="field">
          <span>Special instructions</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. well done, cut in squares" maxLength={200} />
        </label>
        <div className="foot">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less">−</button>
              <b>{qty}</b>
              <button onClick={() => setQty(qty + 1)} aria-label="More">+</button>
            </span>
            <button className="btn" disabled={!v.ok} onClick={add}>
              <span>{v.ok ? "Add to order" : v.errors[0]}</span>
              <span>{money(unit * qty)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <span className="seg">
      {options.map(([v, l]) => <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}
    </span>
  );
}
