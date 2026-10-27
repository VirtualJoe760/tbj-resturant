import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { DemoBanner } from "@/components/DemoBanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo inbox" };

// Every email the site would have sent. On a live site these go out through Resend instead.
export default async function Inbox() {
  const db = await getDb();
  const mails = await db.select().from(s.emails).orderBy(desc(s.emails.createdAt)).limit(30);
  return (
    <>
      <DemoBanner />
      <div className="page">
        <header className="top"><h1>Demo inbox</h1><p>Emails this demo would have sent · nothing actually goes out</p></header>
        <div className="chips"><Link href="/">← Back to site</Link></div>
        {mails.length === 0 && <p className="note">No emails yet. Place an order or submit a form.</p>}
        {mails.map((m) => (
          <details className="line" key={m.id}>
            <summary style={{ cursor: "pointer" }}>
              <b>{m.subject}</b>
              <div className="mods">To {m.to} · {m.kind} · {m.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
            </summary>
            <div style={{ marginTop: 10 }} dangerouslySetInnerHTML={{ __html: m.html }} />
          </details>
        ))}
      </div>
    </>
  );
}
