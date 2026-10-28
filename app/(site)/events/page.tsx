import Link from "next/link";
import { dayLabel, repeatLabel } from "@/domain/events";
import { formatTime } from "@/domain/hours";
import { getUpcomingEvents } from "@/server/queries";
import { restaurant } from "@/config/restaurant";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [all, { type }] = await Promise.all([getUpcomingEvents(60), searchParams]);
  const types = [...new Set(all.map((e) => e.category))];
  const list = type ? all.filter((e) => e.category === type) : all;
  // schema.org Event data so Google can show events in search
  const jsonLd = list.slice(0, 20).map((e) => ({
    "@context": "https://schema.org", "@type": "Event", name: e.title.replace(/^\W+\s*/, ""), startDate: `${e.on}T${e.startTime ?? "20:00"}`,
    location: { "@type": "Place", name: restaurant.name, address: restaurant.address }, description: e.description,
  }));
  return (
    <>
      <PageHero page="events" title="Events">Live music, bingo, karaoke &amp; more</PageHero>
      <div className="chips">
        <Link className={!type ? "on" : ""} href="/events">All</Link>
        {types.map((t) => <Link key={t} className={type === t ? "on" : ""} href={`/events?type=${encodeURIComponent(t)}`}>{t}</Link>)}
      </div>
      {list.map((e) => {
        const d = dayLabel(e.on);
        return (
          <div className="ev" key={e.id + e.on}>
            <div className="date"><small>{d.dow}</small><b>{d.day}</b></div>
            <div className="grow">
              <b>{e.title}</b>
              <div className="mods">{d.month} {d.day} · {formatTime(e.startTime ?? "20:00")}{repeatLabel(e) ? ` · ${repeatLabel(e)}` : ""}</div>
              <div className="mods">{e.description}</div>
            </div>
            {e.linkPageSlug && <Link className="ibtn" href={`/p/${e.linkPageSlug}`}>Sign up</Link>}
          </div>
        );
      })}
      {list.length === 0 && <p className="note">Nothing scheduled yet — check back soon.</p>}
      <div className="card"><b>Want to play here or throw a party?</b>
        <div className="chips" style={{ margin: "10px 0 0" }}><Link href="/p/play">Book a band</Link><Link href="/p/private-events">Private events</Link><Link href="/p/catering">Catering</Link></div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
