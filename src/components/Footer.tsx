import Link from "next/link";
import { restaurant } from "@/config/restaurant";
import { getFooterPages, getLocation } from "@/server/queries";

export async function Footer() {
  const [pages, loc] = await Promise.all([getFooterPages(), getLocation()]);
  const col = (c: string) => pages.filter((p) => p.footerColumn === c);
  return (
    <footer className="foot">
      <div className="cols">
        <div>
          <h6>{restaurant.shortName}</h6>
          <div>{restaurant.tagline}</div>
        </div>
        <div>
          <h6>Visit</h6>
          <div>{loc.address}</div>
          {loc.hoursSummary.map((h) => <div key={h}>{h}</div>)}
          <div>{loc.phone}</div>
        </div>
        <div>
          <h6>Explore</h6>
          <Link href="/menu">Menu &amp; order</Link>
          <Link href="/events">Events</Link>
          {col("explore").map((p) => <Link key={p.slug} href={`/p/${p.slug}`}>{p.title}</Link>)}
        </div>
        <div>
          <h6>Host with us</h6>
          {col("host").map((p) => <Link key={p.slug} href={`/p/${p.slug}`}>{p.title}</Link>)}
          {restaurant.social.map((s) => <a key={s.label} href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}
        </div>
      </div>
      <div className="legal">
        <span>© {new Date().getFullYear()} {restaurant.name}</span>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/login">Staff login</Link>
      </div>
    </footer>
  );
}
