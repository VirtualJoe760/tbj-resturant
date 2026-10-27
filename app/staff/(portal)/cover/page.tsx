import { addDays } from "@/db/seed";
import { shiftHours, shiftWarnings } from "@/domain/scheduling";
import { askCover, cancelCover, claimCover } from "@/server/actions/staff";
import { DAYS, getStaffContext, short } from "@/server/staff-data";

export const metadata = { title: "Shift cover" };

export default async function Cover() {
  const { me, team, shifts, covers, timeOff, weekStart } = await getStaffContext();
  const dates = DAYS.map((_, i) => addDays(weekStart, i));
  const name = (id: string | null) => team.find((t) => t.id === id)?.name ?? "";
  const label = (x: (typeof shifts)[number]) => `${DAYS[dates.indexOf(x.date)]} ${Number(x.date.slice(8))} · ${short(x.start)}–${short(x.end)} · ${x.position}`;
  const live = covers.filter((c) => c.status === "open" || c.status === "claimed");
  const forMe = live.filter((c) => c.fromEmployeeId !== me.id && shifts.find((x) => x.id === c.shiftId)?.position === me.position);
  const myShifts = shifts.filter((x) => x.employeeId === me.id).sort((a, b) => a.date.localeCompare(b.date));
  const empLike = { id: me.id, name: me.name, maxHoursWeek: me.maxHoursWeek, avail: me.avail as ("prefer" | "ok" | "no")[] };
  return (
    <>
      <header className="top"><h1>Shift cover</h1><p>Give away a shift or pick one up · your manager approves</p></header>
      <div className="sec">Up for grabs</div>
      {forMe.length === 0 && <p className="note">Nothing up for grabs right now.</p>}
      {forMe.map((c) => {
        const x = shifts.find((y) => y.id === c.shiftId)!;
        const w = shiftWarnings({ ...x, employeeId: me.id, id: undefined }, { employee: empLike, weekShifts: shifts.map((y) => ({ ...y })), timeOff: timeOff.map((t) => ({ ...t })) });
        return (
          <div className="line" key={c.id}>
            <b>{label(x)}</b>
            <div className="mods">From {name(c.fromEmployeeId)}{c.note ? ` · ${c.note}` : ""}</div>
            {w.length > 0 && <div className="warnbox">⚠ {w.join(" · ⚠ ")}</div>}
            <div className="chips" style={{ margin: "10px 0 0" }}>
              {c.claimedByEmployeeId === me.id ? <span className="kind new">You offered · waiting for manager</span>
                : c.claimedByEmployeeId ? <span className="kind">Taken by {name(c.claimedByEmployeeId)}</span>
                : <form action={claimCover.bind(null, c.id)}><button className="on">I&apos;ll take it</button></form>}
            </div>
          </div>
        );
      })}
      <div className="sec">My shifts</div>
      {myShifts.map((x) => {
        const c = covers.find((y) => y.shiftId === x.id && y.fromEmployeeId === me.id && ["open", "claimed"].includes(y.status));
        return (
          <div className="mrow" key={x.id}>
            <div className="grow"><b>{label(x)}</b><small>{c ? (c.claimedByEmployeeId ? `${name(c.claimedByEmployeeId)} offered · waiting for manager` : "Posted · waiting for a teammate") : `${shiftHours(x)} hours`}</small></div>
            {c ? <form action={cancelCover.bind(null, c.id)}><button className="ibtn">Cancel</button></form>
              : <form action={askCover.bind(null, x.id, "")}><button className="ibtn">Ask for cover</button></form>}
          </div>
        );
      })}
      <p className="note">You stay on the schedule until your manager approves. Only teammates in the same position can pick up a shift.</p>
    </>
  );
}
