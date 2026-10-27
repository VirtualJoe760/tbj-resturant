import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { createPage, savePage } from "@/server/actions/admin";
import { FieldsEditor } from "./FieldsEditor";

export const metadata = { title: "Pages & forms" };

export default async function PagesAdmin({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const db = await getDb();
  const pages = await db.select().from(s.pages).orderBy(asc(s.pages.title));
  const p = edit ? await db.query.pages.findFirst({ where: eq(s.pages.id, edit) }) : null;

  async function create(form: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    const id = await createPage(form);
    redirect(`/admin/pages?edit=${id}`);
  }

  if (p)
    return (
      <>
        <div className="admin-top"><b>Edit page</b><Link className="ibtn" href="/admin/pages">← All pages</Link></div>
        <form action={savePage}>
          <input type="hidden" name="id" value={p.id} />
          <div className="two">
            <label className="field"><span>Title</span><input name="title" defaultValue={p.title} /></label>
            <label className="field"><span>Subtitle</span><input name="subtitle" defaultValue={p.subtitle} /></label>
          </div>
          <label className="field"><span>Page text (HTML allowed)</span><textarea name="bodyHtml" rows={p.kind === "legal" ? 14 : 5} defaultValue={p.bodyHtml} /></label>
          {p.kind !== "legal" && (
            <>
              <div className="two">
                <label className="field"><span>Footer</span><select name="footerColumn" defaultValue={p.footerColumn ?? ""}><option value="">Not in footer</option><option value="explore">Explore column</option><option value="host">Host with us column</option></select></label>
                <label className="field"><span>Email new submissions to</span><input name="notifyEmail" defaultValue={p.notifyEmail ?? ""} placeholder="owner@…" /></label>
              </div>
              {p.formSchema && (
                <>
                  <label className="field"><span>Submit button text</span><input name="submitLabel" defaultValue={p.submitLabel} /></label>
                  <div className="sec">Form fields</div>
                  <FieldsEditor initial={p.formSchema} />
                </>
              )}
            </>
          )}
          <label className="chk"><input type="checkbox" name="published" defaultChecked={p.status === "published"} /> Published (visible at /p/{p.slug})</label>
          <div className="chips">
            <button className="on">Save page</button>
            <Link href={p.kind === "legal" ? `/${p.slug}` : `/p/${p.slug}`} target="_blank">View page ↗</Link>
          </div>
        </form>
      </>
    );

  return (
    <>
      <div className="admin-top"><b>Pages &amp; forms</b><Link className="ibtn" href="/admin/requests">Submissions</Link></div>
      {pages.map((x) => (
        <Link key={x.id} className="mrow" href={`/admin/pages?edit=${x.id}`}>
          <span>{x.kind === "legal" ? "⚖️" : "📝"}</span>
          <div className="grow"><b>{x.title}</b><small>/{x.kind === "legal" ? "" : "p/"}{x.slug} · {x.kind === "legal" ? "Legal · needs lawyer review" : `${x.formSchema?.length ?? 0} form fields`}</small></div>
          <span className={`kind ${x.status === "published" ? "ok" : ""}`}>{x.status}</span>›
        </Link>
      ))}
      <div className="sec">New page</div>
      <form action={create} className="panel">
        <label className="field"><span>Title</span><input name="title" placeholder="e.g. Trivia Team Sign-up" required /></label>
        <label className="field"><span>Template</span><select name="kind"><option value="form">Form (bookings, applications, inquiries)</option><option value="blank">Blank page</option></select></label>
        <div className="chips"><button className="on">Create</button></div>
      </form>
    </>
  );
}
