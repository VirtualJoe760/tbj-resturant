import { getMenu, getLocation, getServingNow } from "@/server/queries";
import { MenuClient } from "@/components/MenuClient";

export const metadata = { title: "Menu" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [menu, loc, sp, serving] = await Promise.all([getMenu(), getLocation(), searchParams, getServingNow()]);
  return (
    <>
      <header className="top">
        <h1>Menu</h1>
        <p>{loc.open ? "Open now" : "Closed — order ahead"}{serving.length ? ` · Serving ${serving.join(" & ").toLowerCase()}` : ""} · Pickup at {loc.address.split(",")[0]}</p>
      </header>
      {loc.orderingPaused && <div className="warnbox" style={{ margin: 16 }}>Online ordering is paused right now. Please call {loc.phone}.</div>}
      <MenuClient menu={menu} openItem={sp.item} />
    </>
  );
}
