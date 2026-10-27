import Link from "next/link";
import { isDemo, restaurant } from "@/config/restaurant";

export function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div className="demo-banner">
      Demo site built for {restaurant.shortName} · orders aren&apos;t real ·{" "}
      <Link href="/login">Try the test accounts</Link> · <Link href="/demo/inbox">Demo inbox</Link>
    </div>
  );
}
