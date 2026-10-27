import { addDays } from "@/db/seed";
import { requestTimeOff, saveAvailability } from "@/server/actions/staff";
import { todayLocal } from "@/server/queries";
import { DAYS, getStaffContext } from "@/server/staff-data";
import { AvailDays } from "./AvailDays";

export const metadata = { title: "Availability" };

export default async function Availability() {
  const { me, timeOff } = await getStaffContext();
  const mine = timeOff.filter((t) => t.employeeId === me.id);
  const soon = addDays(todayLocal(), 14);
  return (
    <>
      <header className="top"><h1>Availability</h1><p>Your manager sees this when building the schedule</p></header>
      <form action={saveAvailability}>
        <div className="sec">Days I&apos;d like to work</div>
        <AvailDays days={DAYS} initial={me.avail} />
        <div className="sec">Preferred shifts</div>
        <div className="chips">
          {[["Day", "Day 2–8 PM"], ["Night", "Night 8 PM–2 AM"], ["Either", "Either"]].map(([v, l]) => (
            <label key={v} className="chk" style={{ margin: 0 }}><input type="radio" name="window" value={v} defaultChecked={me.preferredWindow === v} /> {l}</label>
          ))}
        </div>
        <label className="field"><span>Max hours per week</span><input type="number" name="max" min={0} max={60} defaultValue={me.maxHoursWeek} /></label>
        <label className="field"><span>Notes for my manager</span><textarea name="note" rows={2} defaultValue={me.note} placeholder="e.g. Class Tuesday mornings until December" /></label>
        <div className="chips"><button className="on">Save availability</button></div>
      </form>

      <div className="sec" id="time-off">Time off</div>
      {mine.length === 0 && <p className="note">No requests yet.</p>}
      {mine.map((t) => (
        <div className="mrow" key={t.id}><span>🏖</span><div className="grow">{t.startsOn === t.endsOn ? t.startsOn : `${t.startsOn} → ${t.endsOn}`}<small>{t.reason || "—"}</small></div><span className={`kind ${t.status === "pending" ? "new" : t.status === "approved" ? "ok" : ""}`}>{t.status}</span></div>
      ))}
      <form action={requestTimeOff} className="panel">
        <div className="two">
          <label className="field"><span>From</span><input type="date" name="from" defaultValue={soon} required /></label>
          <label className="field"><span>To</span><input type="date" name="to" defaultValue={soon} /></label>
        </div>
        <label className="field"><span>Reason (optional)</span><input name="reason" placeholder="e.g. Family trip" /></label>
        <div className="chips"><button className="on">Request time off</button></div>
      </form>
    </>
  );
}
