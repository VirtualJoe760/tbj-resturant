import type { Metadata, Viewport } from "next";
import { isDemo } from "@/config/restaurant";
import { RegisterSW } from "@/components/RegisterSW";
import { fontById, googleFontsHref } from "@/domain/branding";
import { getBrand, iconVersion } from "@/server/branding";
import "./globals.css";

// Name, colors, fonts and icons come from Admin → Branding, so every page reads them live.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  const v = b.iconUrl ? `?v=${iconVersion(b.iconUrl)}` : "";
  return {
    title: { default: b.name, template: `%s · ${b.shortName}` },
    description: b.tagline,
    manifest: "/manifest.webmanifest",
    // demo sites are never indexed (docs/15-intake-and-demo.md)
    robots: isDemo ? { index: false, follow: false } : undefined,
    appleWebApp: { capable: true, title: b.shortName, statusBarStyle: "black-translucent" },
    icons: { icon: [{ url: `/favicon.png${v}`, type: "image/png" }], apple: [{ url: `/apple-icon${v}`, sizes: "180x180" }] },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const b = await getBrand();
  return { themeColor: b.theme.header, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const b = await getBrand();
  const t = b.theme;
  const vars = {
    "--primary": t.primary, "--primary-ink": t.primaryInk, "--header": t.header,
    // Classic uses the theme's page color; the other styles bring their own page and card colors
    ...(b.style === "classic" ? { "--bg": t.bg } : {}),
    "--font-body": fontById(b.bodyFont).stack, "--font-heading": fontById(b.headingFont).stack,
  } as React.CSSProperties;
  const fonts = googleFontsHref([b.headingFont, b.bodyFont]);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {fonts && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        {fonts && <link rel="stylesheet" href={fonts} />}
      </head>
      <body style={vars} className={`style-${b.style}`}>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
