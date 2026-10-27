"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartCount } from "@/components/cart-store";
import { useUnreadAlerts } from "@/components/alerts-store";

export interface Tab {
  href: string;
  label: string;
  icon: string;
  center?: boolean;
  badge?: number | "cart" | "alerts";
  match?: string[]; // extra path prefixes that light this tab
}

export function TabBar({ brand, brandHref, tabs, logo }: { brand: string; brandHref: string; tabs: Tab[]; logo?: string | null }) {
  const path = usePathname();
  const cartCount = useCartCount();
  const unread = useUnreadAlerts();
  const active = (t: Tab) =>
    [t.href, ...(t.match ?? [])].some((h) => (h === "/" || h === "/admin" || h === "/staff" || h === "/kitchen" ? path === h : path.startsWith(h)));
  return (
    <nav className="tabbar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href={brandHref} className="brand">{logo ? <img src={logo} alt={brand} /> : brand}</Link>
      {tabs.map((t) => {
        const badge = t.badge === "cart" ? cartCount : t.badge === "alerts" ? unread : t.badge;
        return (
          <Link key={t.href} href={t.href} className={`${active(t) ? "on" : ""} ${t.center ? "center" : ""}`}>
            <span className="ic">{t.icon}{badge ? <i>{badge}</i> : null}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
