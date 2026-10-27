import { KITCHEN_ROLES, requireRole } from "@/auth/session";
import { TabBar } from "@/components/TabBar";
import { restaurant } from "@/config/restaurant";

export const dynamic = "force-dynamic";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  await requireRole(KITCHEN_ROLES, "/kitchen");
  return (
    <>
      <TabBar brand={`${restaurant.shortName.toUpperCase()} · KITCHEN`} brandHref="/kitchen" tabs={[
        { href: "/kitchen", label: "Orders", icon: "🍳" },
        { href: "/kitchen/86", label: "86 board", icon: "🚫" },
      ]} />
      <div className="page wide">{children}</div>
    </>
  );
}
