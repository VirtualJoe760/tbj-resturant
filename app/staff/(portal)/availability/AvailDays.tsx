"use client";
import { useState } from "react";

export function AvailDays({ days, initial }: { days: string[]; initial: string[] }) {
  const [avail, setAvail] = useState(initial);
  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      {days.map((d, i) => (
        <div className="avrow" key={d}>
          <b>{d}</b>
          <input type="hidden" name={`d${i}`} value={avail[i]} />
          <span className="seg">
            {[["prefer", "Prefer"], ["ok", "OK"], ["no", "Can't"]].map(([v, l]) => (
              <button type="button" key={v} className={`${v} ${avail[i] === v ? "on" : ""}`} onClick={() => setAvail(avail.map((x, j) => (j === i ? v : x)))}>{l}</button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
