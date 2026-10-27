import type { Metadata, Viewport } from "next";
import { isDemo, restaurant } from "@/config/restaurant";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: restaurant.name, template: `%s · ${restaurant.shortName}` },
  description: restaurant.tagline,
  manifest: "/manifest.webmanifest",
  // demo sites are never indexed (docs/15-intake-and-demo.md)
  robots: isDemo ? { index: false, follow: false } : undefined,
  appleWebApp: { capable: true, title: restaurant.shortName, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: restaurant.theme.header, width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = restaurant.theme;
  const vars = { "--primary": t.primary, "--primary-ink": t.primaryInk, "--header": t.header, "--bg": t.bg } as React.CSSProperties;
  return (
    <html lang="en">
      <body style={vars}>{children}</body>
    </html>
  );
}
