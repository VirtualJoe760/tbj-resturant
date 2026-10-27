import { DemoBanner } from "@/components/DemoBanner";
import { Footer } from "@/components/Footer";
import { TabBar } from "@/components/TabBar";
import { Toaster } from "@/components/Toast";
import { restaurant } from "@/config/restaurant";

export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <TabBar
        brand={restaurant.shortName.toUpperCase()}
        brandHref="/"
        tabs={[
          { href: "/", label: "Home", icon: "🏠" },
          { href: "/menu", label: "Menu", icon: "🍕" },
          { href: "/cart", label: "Order", icon: "🛒", center: true, badge: "cart", match: ["/checkout", "/order"] },
          { href: "/events", label: "Events", icon: "🎤" },
          { href: "/account", label: "Account", icon: "👤", match: ["/login"] },
        ]}
      />
      <div className="page wide">
        {children}
        <Footer />
      </div>
      <Toaster />
    </>
  );
}
