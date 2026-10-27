import { desc } from "drizzle-orm";
import { getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { inviteEmployee } from "@/server/actions/admin";
import { restaurant } from "@/config/restaurant";

export const metadata = { title: "Team & access" };

export default async function Team() {
  const me = await getUser();
  const db = await getDb();
  const [emps, invites, users] = await Promise.all([db.select().from(s.employees), db.select().from(s.staffInvites).orderBy(desc(s.staffInvites.createdAt)), db.select().from(s.user)]);
  const canSeePay = me?.role === "admin";
  return (
    <>
      <div className="admin-top"><b>Team &amp; access</b><span className="muted small">{emps.length} employees</span></div>
      <details className="panel">
        <summary style={{ padding: 12, cursor: "pointer", fontWeight: 700 }}>+ Invite an employee</summary>
        <form action={inviteEmployee}>
          <div className="two">
            <label className="field"><span>Name</span><input name="name" required /></label>
            <label className="field"><span>Email or mobile</span><input name="contact" required /></label>
          </div>
          <label className="field"><span>Position</span><select name="position">{["Bartender", "Cook", "Server", "Door"].map((p) => <option key={p}>{p}</option>)}</select></label>
          <div className="chips"><button className="on">Send invite code</button></div>
        </form>
      </details>
      {invites.map((i) => <div className="mrow" key={i.code}><span>✉️</span><div className="grow"><b>{i.name}</b><small>Invite {i.code} · {i.contact} · {i.position}</small></div><span className="kind">{i.usedAt ? "Joined" : "Pending"}</span></div>)}

      <div className="sec">Employees</div>
      {emps.map((e) => (
        <div className="mrow" key={e.id}>
          <div className="grow"><b>{e.name}</b><small>{e.position} · max {e.maxHoursWeek}h/week{canSeePay ? ` · $${(e.payRateCents / 100).toFixed(2)}/h` : ""}{e.userId ? " · has app account" : ""}</small></div>
          <span className="kind ok">{e.status}</span>
        </div>
      ))}

      <div className="sec">Accounts &amp; roles</div>
      {users.map((u) => (
        <div className="mrow" key={u.id}>
          <div className="grow"><b>{u.email}</b><small>{u.name}{u.isTestAccount ? " · test account" : ""}</small></div>
          <span className="kind">{u.role}</span>
        </div>
      ))}
      <div className="mrow"><span>📟</span><div className="grow"><b>Kitchen tablet</b><small>Sign in on the tablet as kitchen@{restaurant.domain}. Pairing codes for extra tablets come with launch.</small></div></div>
      <p className="note">Roles: admin (owner) · manager · employee · kitchen · customer. Webmaster access comes from the server settings, not this list.</p>
    </>
  );
}
