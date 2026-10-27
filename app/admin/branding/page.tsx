import { getBrand } from "@/server/branding";
import { FONTS, googleFontsHref } from "@/domain/branding";
import { BrandingClient } from "./BrandingClient";

export const metadata = { title: "Branding" };

export default async function BrandingPage() {
  const b = await getBrand();
  return (
    <>
      {/* every font, so the pickers can preview them */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(FONTS.map((f) => f.id))!} />
      <div className="admin-top"><b>Branding</b><span className="muted small">Logo, photos, fonts, colors, app icon</span></div>
      <BrandingClient
        initial={{ theme: b.theme, headingFont: b.headingFont, bodyFont: b.bodyFont, logoUrl: b.logoUrl, iconUrl: b.iconUrl, banners: b.banners, gallery: b.gallery }}
        base={b.base} name={b.name} shortName={b.shortName} tagline={b.tagline}
      />
    </>
  );
}
