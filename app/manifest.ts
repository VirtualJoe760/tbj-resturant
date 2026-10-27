import type { MetadataRoute } from "next";
import { restaurant } from "@/config/restaurant";
import { getBrand, iconVersion } from "@/server/branding";

export const dynamic = "force-dynamic";

// Install details for phones, and the starting point for the Play Store / App Store builds.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getBrand();
  const v = b.iconUrl ? `?v=${iconVersion(b.iconUrl)}` : ""; // new icon → new URL, so phones refetch it
  return {
    id: "/",
    name: b.name,
    short_name: b.shortName,
    description: b.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["food", "lifestyle"],
    background_color: b.theme.header,
    theme_color: b.theme.header,
    icons: [
      { src: `/icon-192${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icon-512${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icon-maskable${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Order now", url: "/menu" },
      ...(restaurant.features.events ? [{ name: "Events", url: "/events" }] : []),
    ],
  };
}
