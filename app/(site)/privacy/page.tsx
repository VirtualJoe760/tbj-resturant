import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";

export const metadata = { title: "Privacy" };

export default async function Page() {
  const db = await getDb();
  const p = await db.query.pages.findFirst({ where: eq(s.pages.slug, "privacy") });
  return (
    <>
      <header className="top"><h1>{p?.title}</h1><p>Last updated {p?.updatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p></header>
      <div className="prose" dangerouslySetInnerHTML={{ __html: p?.bodyHtml ?? "" }} />
    </>
  );
}
