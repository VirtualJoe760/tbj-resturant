import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { RequestActions } from "./RequestActions";

export const metadata = { title: "Requests" };

const STEPS: Record<string, string[]> = {
  band: ["New", "Contacted", "Booked", "Declined"],
  private: ["New", "Quoted", "Deposit paid", "Booked", "Declined"],
  catering: ["New", "Quoted", "Deposit paid", "Booked", "Declined"],
  jobs: ["New", "Interview", "Hired", "Declined"],
  other: ["New", "Contacted", "Done"],
};
const KINDS: [string, string][] = [["all", "All"], ["band", "🎸 Bands"], ["private", "🎉 Private events"], ["catering", "🍕 Catering"], ["jobs", "💼 Jobs"]];

export default async function Requests({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = "all" } = await searchParams;
  const user = await getUser();
  const db = await getDb();
  const rows = await db.select({ sub: s.formSubmissions, page: { title: s.pages.title, requestType: s.pages.requestType } })
    .from(s.formSubmissions).innerJoin(s.pages, eq(s.pages.id, s.formSubmissions.pageId)).orderBy(desc(s.formSubmissions.createdAt));
  // job applications are personal data: owners and managers only
  const visible = rows.filter((r) => r.page.requestType !== "jobs" || ["webmaster", "admin", "manager"].includes(user!.role));
  const list = visible.filter((r) => type === "all" || r.page.requestType === type);
  const nNew = visible.filter((r) => r.sub.status === "New").length;
  return (
    <>
      <div className="admin-top"><b>Requests</b>{nNew > 0 && <span className="kind new">{nNew} new</span>}</div>
      <div className="chips">{KINDS.map(([k, l]) => <Link key={k} className={type === k ? "on" : ""} href={`/admin/requests?type=${k}`}>{l}</Link>)}</div>
      {list.length === 0 && <p className="note">Nothing here yet.</p>}
      {list.map(({ sub, page }) => {
        const kind = page.requestType ?? "other";
        return (
          <div className="line" key={sub.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{sub.submitterName}</b><span className={`kind ${sub.status === "New" ? "new" : ""}`}>{sub.status}</span></div>
            <div className="mods">{page.title} · {sub.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{sub.submitterEmail ? ` · ${sub.submitterEmail}` : ""}</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>{Object.entries(sub.data).filter(([k]) => !["name", "email"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
            {sub.depositCents ? <div className="mods">Deposit requested: ${(sub.depositCents / 100).toFixed(2)}</div> : null}
            <RequestActions id={sub.id} status={sub.status} steps={STEPS[kind] ?? STEPS.other} kind={kind} email={sub.submitterEmail} />
          </div>
        );
      })}
      <p className="note">Every form page sends its entries here. Job applications are visible to owners and managers only.</p>
    </>
  );
}
