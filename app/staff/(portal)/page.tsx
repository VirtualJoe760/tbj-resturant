import Link from "next/link";
import { addDays } from "@/db/seed";
import { shiftHours } from "@/domain/scheduling";
import { todayLocal } from "@/server/queries";
import { DAYS, getStaffContext, short } from "@/server/staff-data";

export const metadata = { title: "My schedule" };

const POS: Record<string, string> = { Bartender: "#d97706", Cook: "#dc2626", Server: "#2563eb", Door: "#7c3aed" };

export default async function StaffSchedule({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ me, team, shifts, weekStart, covers }, { view = "me" }] = await Promise.all([getStaffContext(), searchParams]);
  const today = todayLocal();
  const mine = shifts.filter((x) => x.employeeId === me.id).sort((a, b) => a.date.localeCompare(b.date));
  const next = mine.find((x) => x.date >= today);
  const openForMe = covers.filter((c) => c.status === "open" && c.fromEmployeeId !== me.id && shifts.find((x) => x.id === c.shiftId)?.position === me.position).length;
  const dates = DAYS.map((_, i) => addDays(weekStart, i));
  return (
    <>
      <header className="top"><h1>Hi, {me.name.split(" ")[0]} 👋</h1><p>{me.position} · Week of {new Date(weekStart + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></header>
      {next && (
        <div className="card">
          <small className="muted">NEXT SHIFT · {next.date === today ? "TODAY" : `${DAYS[dates.indexOf(next.date)]?.toUpperCase()} ${Number(next.date.slice(8))}`}</small>
          <div style={{ fontSize: 26, fontWeight: 800, margin: "4px 0" }}>{short(next.start)} – {short(next.end)}</div>
          <div className="mods">{next.position} · {shiftHours(next)} hours</div>
          <div className="chips" style={{ margin: "10px 0 0" }}><Link className="on" href="/staff/clock">Clock in</Link></div>
        </div>
      )}
      <div className="chips">
        <Link className={view === "me" ? "on" : ""} href="/staff?view=me">My shifts</Link>
        <Link className={view === "team" ? "on" : ""} href="/staff?view=team">Whole team</Link>
      </div>
      {dates.map((d, i) => {
        if (view === "team") {
          const who = shifts.filter((x) => x.date === d).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div key={d} className={`dayrow ${d === today ? "today" : ""}`}>
              <span className="d">{DAYS[i]} {Number(d.slice(8))}</span>
              <div style={{ fontSize: 13 }}>{who.length ? who.map((x) => <div key={x.id}><span style={{ color: POS[x.position], fontWeight: 700 }}>●</span> {team.find((t) => t.id === x.employeeId)?.name.split(" ")[0]} {short(x.start)}–{short(x.end)}</div>) : "—"}</div>
            </div>
          );
        }
        const x = mine.find((y) => y.date === d);
        return (
          <div key={d} className={`dayrow ${x ? "" : "off"} ${d === today ? "today" : ""}`}>
            <span className="d">{DAYS[i]} {Number(d.slice(8))}</span>
            <span style={{ flex: 1 }}>{x ? <><b>{short(x.start)} – {short(x.end)}</b> · {x.position}</> : "Off"}</span>
            {x && <small className="muted">{shiftHours(x)}h</small>}
          </div>
        );
      })}
      <p className="note">{mine.reduce((a, x) => a + shiftHours(x), 0)} hours scheduled this week</p>
      <div className="card">
        <b>Can&apos;t make a shift?</b>
        <div className="mods">Ask the team to cover it, or request time off. Your manager approves either one.</div>
        <div className="chips" style={{ margin: "10px 0 0" }}>
          <Link className="on" href="/staff/cover">Shift cover{openForMe ? <i className="cnt">{openForMe}</i> : null}</Link>
          <Link href="/staff/availability#time-off">Time off</Link>
        </div>
      </div>
    </>
  );
}
