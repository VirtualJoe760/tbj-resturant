import type { MetadataRoute } from "next";
import { restaurant } from "@/config/restaurant";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: restaurant.name,
    short_name: restaurant.shortName,
    description: restaurant.tagline,
    start_url: "/",
    display: "standalone",
    background_color: restaurant.theme.header,
    theme_color: restaurant.theme.header,
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
