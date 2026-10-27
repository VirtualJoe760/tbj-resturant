"use client";
import { useOptimistic, useTransition } from "react";
import { money } from "@/domain/pricing";
import { toggle86 } from "@/server/actions/admin";

export function Board86({ items }: { items: { id: string; name: string; emoji: string; basePriceCents: number; soldOut: boolean; category: string }[] }) {
  const [list, setList] = useOptimistic(items, (cur, id: string) => cur.map((i) => (i.id === id ? { ...i, soldOut: !i.soldOut } : i)));
  const [, start] = useTransition();
  let lastCat = "";
  return (
    <div>
      {list.map((i) => {
        const head = i.category !== lastCat ? <div className="sec" key={"c" + i.category}>{i.category}</div> : null;
        lastCat = i.category;
        return [
          head,
          <div className="row big86" key={i.id}>
            <span>{i.emoji} <b>{i.name}</b> <small className="muted">{money(i.basePriceCents)}</small>{i.soldOut && <span className="kind new" style={{ marginLeft: 8 }}>86&apos;d</span>}</span>
            <button className={`switch ${i.soldOut ? "off" : ""}`} aria-label={`${i.soldOut ? "Bring back" : "86"} ${i.name}`}
              onClick={() => start(async () => { setList(i.id); await toggle86(i.id); })} />
          </div>,
        ];
      })}
      <p className="note">Switch off = sold out until close. Updates the website and phone ordering right away.</p>
    </div>
  );
}
