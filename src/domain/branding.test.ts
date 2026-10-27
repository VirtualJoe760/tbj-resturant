import { describe, expect, it } from "vitest";
import { diffBranding, fromBusinessTheme, googleFontsHref, inkFor, resolveBranding } from "./branding";

const base = fromBusinessTheme({ logo: "/brand/logo.png", appIcon: null, heroBanners: ["/brand/hero-1.jpg"], fonts: { heading: "oswald", body: "system" }, colors: { accent: "#F5A524", header: "#18181b", background: "#f5f5f4" } });

describe("branding", () => {
  it("picks readable button text", () => {
    expect(inkFor("#F5A524")).toBe("#18181b");
    expect(inkFor("#1d4ed8")).toBe("#ffffff");
  });
  it("business-theme.ts is the base; admin overrides win, bad ones fall back", () => {
    const b = resolveBranding({ theme: { primary: "red", header: "#123456" }, headingFont: "nope", logoUrl: null }, base);
    expect(b.theme.primary).toBe("#F5A524");
    expect(b.theme.header).toBe("#123456");
    expect(b.headingFont).toBe("oswald");
    expect(b.logoUrl).toBeNull(); // owner removed the logo
    expect(b.banners).toEqual(["/brand/hero-1.jpg"]);
  });
  it("stores only what differs from the theme file", () => {
    expect(diffBranding(base, base)).toEqual({});
    expect(diffBranding({ ...base, bodyFont: "inter", theme: { ...base.theme, bg: "#FFFFFF" } }, base)).toEqual({ bodyFont: "inter", theme: { bg: "#FFFFFF" } });
  });
  it("loads only the Google fonts in use", () => {
    expect(googleFontsHref(["system", "system"])).toBeNull();
    expect(googleFontsHref(["oswald", "inter", "oswald"])).toBe("https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;600;700;800&display=swap");
  });
});
