"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/Toast";
import { money } from "@/domain/pricing";
import { shiftHours, shiftWarnings, type AvailState } from "@/domain/scheduling";
import { copyLastWeek, decideCover, decideTimeOff, deleteShift, publishSchedule, saveShift } from "@/server/actions/admin";

interface Emp { id: string; name: string; position: string; maxHoursWeek: number; avail: AvailState[]; payRateCents: number; preferredWindow: string; note: string }
interface Shift { id: string; employeeId: string; date: string; start: string; end: string; position: string }
interface TimeOff { id: string; employeeId: string; startsOn: string; endsOn: string; status: "pending" | "approved" | "denied"; reason: string }
interface Cover { id: string; shiftId: string; from: string; by: string | null; status: string; note: string }

const POS: Record<string, string> = { Bartender: "#d97706", Cook: "#dc2626", Server: "#2563eb", Door: "#7c3aed" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const short = (t: string) => { const [h0, m] = t.split(":").map(Number); let h = h0; const ap = h >= 12 ? "p" : "a"; h = h % 12 || 12; return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap; };
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

export function ScheduleClient({ weekStart, employees, shifts, timeOff, covers }: { weekStart: string; employees: Emp[]; shifts: Shift[]; timeOff: TimeOff[]; covers: Cover[] }) {
  const [form, setForm] = useState<(Omit<Shift, "id"> & { id?: string }) | null>(null);
  const [pending, start] = useTransition();
  const dates = DAYS.map((_, i) => addDays(weekStart, i));
  const emp = (id: string) => employees.find((e) => e.id === id)!;
  const warn = (sh: Shift | (Omit<Shift, "id"> & { id?: string })) => shiftWarnings(sh, { employee: emp(sh.employeeId), weekShifts: shifts, timeOff });
  const hours = (id: string) => shifts.filter((x) => x.employeeId === id).reduce((a, x) => a + shiftHours(x), 0);
  const total = shifts.reduce((a, x) => a + shiftHours(x), 0);
  const cost = shifts.reduce((a, x) => a + shiftHours(x) * (emp(x.employeeId)?.payRateCents ?? 0), 0);
  const flagged = shifts.filter((x) => warn(x).length).length;
  const formWarn = useMemo(() => (form ? warn(form) : []), [form]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCell = (e: Emp, date: string) => {
    const existing = shifts.find((x) => x.employeeId === e.id && x.date === date);
    setForm(existing ?? { employeeId: e.id, date, start: e.preferredWindow === "Day" ? "14:00" : "18:00", end: e.preferredWindow === "Day" ? "20:00" : "02:00", position: e.position });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const run = (fn: () => Promise<unknown>, msg: string) => start(async () => { await fn(); toast(msg); });

  const pendingTO = timeOff.filter((t) => t.status === "pending" && t.startsOn <= dates[6] && t.endsOn >= dates[0]);
  return (
    <>
      {pendingTO.map((t) => (
        <div className="mrow" key={t.id}>
          <span>🏖</span>
          <div className="grow"><b>{emp(t.employeeId)?.name} — time off</b><small>{t.startsOn === t.endsOn ? t.startsOn : `${t.startsOn} → ${t.endsOn}`}{t.reason ? ` · ${t.reason}` : ""}</small></div>
          <button className="ibtn" disabled={pending} onClick={() => run(() => decideTimeOff(t.id, false), "Time off denied")}>Deny</button>
          <button className="ibtn go" disabled={pending} onClick={() => run(() => decideTimeOff(t.id, true), "Time off approved")}>Approve</button>
        </div>
      ))}
      {covers.map((c) => {
        const sh = shifts.find((x) => x.id === c.shiftId);
        if (!sh) return null;
        const label = `${DAYS[dates.indexOf(sh.date)] ?? sh.date} · ${short(sh.start)}–${short(sh.end)} · ${sh.position}`;
        if (!c.by) return <div className="mrow" key={c.id}><span>🔁</span><div className="grow"><b>{emp(c.from)?.name} wants cover</b><small>{label} · no one has offered yet{c.note ? ` · ${c.note}` : ""}</small></div></div>;
        const w = warn({ ...sh, employeeId: c.by });
        return (
          <div className="mrow" key={c.id}>
            <span>🔁</span>
            <div className="grow"><b>{emp(c.by)?.name} covers {emp(c.from)?.name}</b><small>{label}{w.length ? <span style={{ color: "var(--bad)" }}> · ⚠ {w.join(" · ")}</span> : " · ✓ no conflicts"}</small></div>
            <button className="ibtn" disabled={pending} onClick={() => run(() => decideCover(c.id, false), "Cover denied · both notified")}>Deny</button>
            <button className="ibtn go" disabled={pending} onClick={() => run(() => decideCover(c.id, true), "Shift moved · both notified")}>Approve</button>
          </div>
        );
      })}

      {form && (
        <div className="panel">
          <div className="two">
            <label className="field"><span>Day</span><select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}>{dates.map((d, i) => <option key={d} value={d}>{DAYS[i]} {d.slice(8)}</option>)}</select></label>
            <label className="field"><span>Position</span><select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>{Object.keys(POS).map((p) => <option key={p}>{p}</option>)}</select></label>
          </div>
          <label className="field"><span>Team member</span>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {{ prefer: "prefers", ok: "available", no: "can't work" }[e.avail[dates.indexOf(form.date)]]} · {hours(e.id)}h</option>)}
            </select>
          </label>
          <div className="two">
            <label className="field"><span>Start</span><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            <label className="field"><span>End (after midnight is fine)</span><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          </div>
          <div style={{ margin: "0 12px" }}>
            {formWarn.length ? <div className="warnbox">⚠ {formWarn.join(" · ⚠ ")}<br /><small>You can still save — it&apos;s flagged for review.</small></div>
              : <div className="okbox">✓ {shiftHours(form)}h · fits {emp(form.employeeId).name.split(" ")[0]}&apos;s availability</div>}
          </div>
          <div className="chips">
            <button onClick={() => setForm(null)}>Cancel</button>
            {form.id && <button disabled={pending} onClick={() => run(async () => { await deleteShift(form.id!, weekStart); setForm(null); }, "Shift deleted")}>Delete</button>}
            <button className="on" disabled={pending} onClick={() => run(async () => { await saveShift({ ...form, weekStart }); setForm(null); }, "Shift saved")}>Save shift</button>
          </div>
        </div>
      )}

      <div className="legend">
        <span><i style={{ background: "#dcfce7" }} />Prefers</span>
        <span><i style={{ background: "#fff", border: "1px solid var(--line)" }} />Available</span>
        <span><i style={{ background: "#e7e5e4" }} />Can&apos;t work</span>
        <span><i style={{ background: "#fff", outline: "2px solid var(--bad)" }} />Needs attention</span>
      </div>
      <div className="sgrid-wrap">
        <table className="sgrid">
          <thead><tr><th>Team</th>{dates.map((d, i) => <th key={d}>{DAYS[i]}<br /><small>{Number(d.slice(8))}</small></th>)}<th>Hrs</th></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="emp"><b>{e.name}</b><br /><small style={{ color: POS[e.position] }}>{e.position}</small></td>
                {dates.map((d, i) => (
                  <td key={d} className={`cell ${e.avail[i]}`} title={`${e.name}: ${e.avail[i]}`} onClick={() => openCell(e, d)}>
                    {shifts.filter((x) => x.employeeId === e.id && x.date === d).map((x) => (
                      <span key={x.id} className={`shift ${warn(x).length ? "warn" : ""}`} style={{ background: POS[x.position] ?? "#57534e" }}>{short(x.start)}–{short(x.end)}</span>
                    ))}
                  </td>
                ))}
                <td style={{ fontWeight: 700, color: hours(e.id) > e.maxHoursWeek ? "var(--bad)" : undefined }}>{hours(e.id)}</td>
              </tr>
            ))}
            <tr><th>Total</th>{dates.map((d) => <th key={d}>{shifts.filter((x) => x.date === d).reduce((a, x) => a + shiftHours(x), 0)}h</th>)}<th>{total}h</th></tr>
          </tbody>
        </table>
      </div>
      <p className="note">Tap any cell to add or edit a shift.</p>
      <div className="mrow"><div className="grow"><b>{total} hours · est. {money(cost)} labor</b><small>{flagged ? `⚠ ${flagged} shift${flagged > 1 ? "s" : ""} need attention (red outline)` : "✓ No conflicts"}</small></div></div>
      <div className="chips">
        <button disabled={pending} onClick={() => run(async () => { const n = await copyLastWeek(weekStart); toast(n ? `Copied ${n} shifts` : "Nothing to copy from last week"); }, "")}>Copy last week</button>
        <button className="on" disabled={pending} onClick={() => run(async () => { const n = await publishSchedule(weekStart); toast(`Published — ${n} people notified`); }, "")}>Publish &amp; notify team</button>
      </div>
    </>
  );
}
