import { requireRole } from "@/auth/session";
import { TabBar } from "@/components/TabBar";
import { Toaster } from "@/components/Toast";
import { DemoBanner } from "@/components/DemoBanner";
import { restaurant } from "@/config/restaurant";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["employee", "admin", "manager", "webmaster"], "/staff");
  return (
    <>
      <DemoBanner />
      <TabBar brand={`${restaurant.shortName.toUpperCase()} · STAFF`} brandHref="/staff" tabs={[
        { href: "/staff", label: "Schedule", icon: "📅", match: ["/staff/cover"] },
        { href: "/staff/clock", label: "Clock", icon: "🕒", center: true },
        { href: "/staff/availability", label: "Availability", icon: "✋" },
      ]} />
      <div className="page">{children}</div>
      <Toaster />
    </>
  );
}
