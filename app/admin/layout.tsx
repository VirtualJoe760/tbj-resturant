import { eq, sql } from "drizzle-orm";
import { ADMIN_ROLES, requireRole } from "@/auth/session";
import { TabBar } from "@/components/TabBar";
import { Toaster } from "@/components/Toast";
import { DemoBanner } from "@/components/DemoBanner";
import { restaurant } from "@/config/restaurant";
import { getDb, schema as s } from "@/db/client";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ADMIN_ROLES, "/admin");
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.formSubmissions).where(eq(s.formSubmissions.status, "New"));
  return (
    <>
      <DemoBanner />
      <TabBar brand={`${restaurant.shortName.toUpperCase()} · ADMIN`} brandHref="/admin" tabs={[
        { href: "/admin", label: "Home", icon: "📊" },
        { href: "/admin/kitchen", label: "Kitchen", icon: "🍳" },
        { href: "/admin/schedule", label: "Schedule", icon: "🗓", match: ["/admin/timesheets"] },
        { href: "/admin/events", label: "Events", icon: "🎤" },
        { href: "/admin/more", label: "More", icon: "☰", badge: n || undefined, match: ["/admin/menu", "/admin/branding", "/admin/pages", "/admin/requests", "/admin/team", "/admin/newsletter", "/admin/orders"] },
      ]} />
      <div className="page wide">{children}</div>
      <Toaster />
    </>
  );
}
