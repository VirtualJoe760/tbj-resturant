import Link from "next/link";
import { restaurant } from "@/config/restaurant";
import { dayLabel, repeatLabel } from "@/domain/events";
import { formatTime } from "@/domain/hours";
import { money } from "@/domain/pricing";
import { getHomeData } from "@/server/queries";
import { getBrand } from "@/server/branding";
import { HeroBanners } from "@/components/HeroBanners";
import { NewsletterSignup } from "./NewsletterSignup";

export default async function Home() {
  const [{ featured, upcoming, location }, brand] = await Promise.all([getHomeData(), getBrand()]);
  return (
    <>
      <section className="hero">
        {brand.banners.length > 0 && <HeroBanners urls={brand.banners} />}
        {brand.banners.some((u) => /^https?:|^\/api\/places-photo/.test(u)) && <span className="photo-credit">Photos: {[brand.banners.some((u) => u.includes("places-photo")) && "Google", brand.banners.some((u) => u.includes("yelp")) && "Yelp"].filter(Boolean).join(" & ") || "listings"}</span>}
        <div className={`status ${location.open ? "open" : "closed"}`}>
          {location.open ? "● Open now" : "● Closed now"} · {location.hoursSummary[0]}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {brand.logoUrl && <img className="logo" src={brand.logoUrl} alt="" />}
        <h1 className="name">{brand.name}</h1>
        <p>{brand.tagline}</p>
        <Link className="btn" href="/menu">
          <span>{location.open ? "Order now" : "Order ahead"}</span>
          <span>Pickup ~{location.pickupLeadMinutes + (location.busy ? 15 : 0)} min →</span>
        </Link>
      </section>

      <div className="sec">Specials &amp; new <Link href="/menu">Full menu →</Link></div>
      <div className="scroller">
        {featured.map((f) => (
          <Link key={f.id} className="special" href={`/menu?item=${f.id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.images[0] ? <img className="em photo" src={f.images[0]} alt="" loading="lazy" /> : <div className="em">{f.emoji}</div>}
            <span className="badge">{f.badge}</span>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{f.name}</div>
            <div className="mods">{f.blurb}</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>from {money(f.price)}</div>
          </Link>
        ))}
      </div>

      {restaurant.features.events && upcoming.length > 0 && (
        <>
          <div className="sec">Coming up <Link href="/events">All events →</Link></div>
          {upcoming.map((e) => {
            const d = dayLabel(e.on);
            return (
              <div className="ev" key={e.id + e.on}>
                <div className="date"><small>{d.dow}</small><b>{d.day}</b></div>
                <div className="grow">
                  <b>{e.title}</b>
                  <div className="mods">{formatTime(e.startTime ?? "20:00")} · {e.description}{repeatLabel(e) ? ` · ${repeatLabel(e)}` : ""}</div>
                </div>
                {e.linkPageSlug && <Link className="ibtn" href={`/p/${e.linkPageSlug}`}>Sign up</Link>}
              </div>
            );
          })}
        </>
      )}

      {brand.gallery.length > 0 && (
        <>
          <div className="sec">Photos</div>
          <div className="scroller gallery">
            {brand.gallery.map((g) => (
              <figure key={g.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.alt ?? ""} loading="lazy" />
                {g.credit && <figcaption>{g.credit}</figcaption>}
              </figure>
            ))}
          </div>
        </>
      )}

      <div className="sec">Visit us</div>
      <div className="card">
        <b>{location.address}</b>
        <div className="mods">{location.hoursSummary.join(" · ")} · {location.phone}</div>
        <div className="chips" style={{ margin: "10px 0 0" }}>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(location.address)}`} target="_blank" rel="noreferrer">Directions</a>
          <a href={`tel:${location.phone}`}>Call</a>
          <Link href="/p/private-events">Book a party</Link>
        </div>
      </div>

      {restaurant.features.newsletter && <NewsletterSignup />}
    </>
  );
}
