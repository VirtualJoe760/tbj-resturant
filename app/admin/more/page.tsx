import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { SignOut } from "@/components/SignOut";

export const metadata = { title: "More" };

export default async function More() {
  const db = await getDb();
  const user = await getUser();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.formSubmissions).where(eq(s.formSubmissions.status, "New"));
  const [{ subs }] = await db.select({ subs: sql<number>`count(*)::int` }).from(s.subscribers);
  const rows: [string, string, string, string, number?][] = [
    ["/admin/requests", "📬", "Requests", "Bands, private events, catering, jobs", n],
    ["/admin/menu", "🍕", "Menu & 86 board", "Items, prices, sold-out toggles"],
    ["/admin/timesheets", "⏱", "Timesheets", "Hours, breaks, payroll export"],
    ["/admin/team", "👥", "Team & access", "Invite employees, kitchen tablet, owners"],
    ["/admin/pages", "📄", "Pages & forms", "Build pages and forms, legal pages"],
    ["/admin/newsletter", "✉️", "Newsletter", `${subs} subscribers`],
    ["/admin/orders", "🧾", "Orders & refunds", "Every order, refund with one tap"],
    ["/demo/inbox", "📥", "Demo inbox", "Every email the site has sent"],
  ];
  return (
    <>
      <div className="admin-top"><b>More</b><span className="muted small">{user?.email}</span></div>
      {rows.map(([href, ic, title, sub, badge]) => (
        <Link key={href} className="mrow" href={href}><span>{ic}</span><div className="grow">{title}<small>{sub}</small></div>{badge ? <i className="cnt">{badge}</i> : null}›</Link>
      ))}
      <div className="mrow" style={{ opacity: .6 }}><span>📞</span><div className="grow">Phone calls<small>Voice agent call log · turns on with the Retell number</small></div></div>
      <div className="mrow" style={{ opacity: .6 }}><span>🛠</span><div className="grow">Webmaster tools<small>Domain, integrations, feature flags, backups · webmaster only</small></div>{user?.role === "webmaster" ? "›" : "🔒"}</div>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}><SignOut /></div>
    </>
  );
}
