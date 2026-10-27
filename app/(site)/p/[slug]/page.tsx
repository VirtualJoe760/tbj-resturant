import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { PageForm } from "./PageForm";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const db = await getDb();
  const p = await db.query.pages.findFirst({ where: eq(s.pages.slug, (await params).slug) });
  return { title: p?.title ?? "Page" };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const db = await getDb();
  const page = await db.query.pages.findFirst({ where: eq(s.pages.slug, (await params).slug) });
  if (!page || page.status !== "published") notFound();
  return (
    <>
      <header className="top"><h1>{page.title}</h1>{page.subtitle && <p>{page.subtitle}</p>}</header>
      {/* body HTML is written by admins in the page builder */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      {page.formSchema && <PageForm slug={page.slug} fields={page.formSchema} submitLabel={page.submitLabel} />}
    </>
  );
}
