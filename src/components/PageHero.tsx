import { HeroBanners } from "@/components/HeroBanners";
import { heroFor } from "@/domain/branding";
import type { HeroPage } from "@/config/types";
import { getBrand } from "@/server/branding";

/** A page's title bar with its hero carousel behind it (Admin → Branding → hero carousels). */
export async function PageHero({ page, title, children }: { page: HeroPage; title: React.ReactNode; children?: React.ReactNode }) {
  const urls = heroFor(await getBrand(), page);
  return (
    <header className={`top${urls.length ? " photo" : ""}`}>
      {urls.length > 0 && <HeroBanners urls={urls} />}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
