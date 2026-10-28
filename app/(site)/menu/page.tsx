import { getMenu, getLocation, getServingNow } from "@/server/queries";
import { MenuClient } from "@/components/MenuClient";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Menu" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [menu, loc, sp, serving] = await Promise.all([getMenu(), getLocation(), searchParams, getServingNow()]);
  return (
    <>
      <PageHero page="menu" title="Menu">
        {loc.open ? "Open now" : "Closed — order ahead"}{serving.length ? ` · Serving ${serving.join(" & ").toLowerCase()}` : ""}{loc.address ? ` · Pickup at ${loc.address.split(",")[0]}` : ""}
      </PageHero>
      {loc.orderingPaused && <div className="warnbox" style={{ margin: 16 }}>Online ordering is paused right now. Please call {loc.phone}.</div>}
      <MenuClient menu={menu} openItem={sp.item} />
    </>
  );
}
