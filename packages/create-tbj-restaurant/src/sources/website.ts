// Reads the restaurant's own website: visible text (for the menu), images, theme color, email, socials.
import type { Photo } from "../types.ts";

const strip = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

export async function readWebsite(url: string) {
  const base = new URL(url.startsWith("http") ? url : `https://${url}`);
  const get = async (u: URL) => {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (restaurant-intake)" }, redirect: "follow" });
    return r.ok ? r.text() : "";
  };
  const home = await get(base);
  // follow up to two menu-looking links on the same site
  const links = [...home.matchAll(/href="([^"#]+)"/gi)].map((m) => { try { return new URL(m[1], base); } catch { return null; } })
    .filter((u): u is URL => !!u && u.host === base.host && /menu|food|eat|order/i.test(u.pathname)).slice(0, 2);
  const pages = [home, ...(await Promise.all(links.map(get)))];
  const all = pages.join("\n");

  const images = [...new Set([...all.matchAll(/<img[^>]+src="([^"]+)"/gi), ...all.matchAll(/property="og:image"\s+content="([^"]+)"/gi)].map((m) => m[1]))]
    .map((src) => { try { return new URL(src, base).toString(); } catch { return null; } })
    .filter((u): u is string => !!u && /\.(jpe?g|png|webp)(\?|$)/i.test(u)).slice(0, 15);

  const text = pages.map(strip).join("\n\n").slice(0, 60000);
  // their logo (an <img> named like one) and app icon (apple-touch-icon, or a large favicon)
  const abs = (u?: string) => { try { return u ? new URL(u, base).toString() : undefined; } catch { return undefined; } };
  const raster = (u?: string) => (u && /\.(png|jpe?g|webp)(\?|$)/i.test(u) ? u : undefined);
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, "i"))?.[1];
  const logoTag = (home.match(/<img[^>]+>/gi) ?? []).find((t) => /logo/i.test(t));
  const logoUrl = raster(abs(logoTag && (attr(logoTag, "src") ?? attr(logoTag, "data-src"))));
  const linkTags = home.match(/<link[^>]+>/gi) ?? [];
  const touch = linkTags.find((t) => /rel=["']apple-touch-icon/i.test(t)) ?? linkTags.find((t) => /rel=["'][^"']*icon/i.test(t) && /sizes=["'](19[2-9]|[2-9]\d\d|\d{4})/i.test(t));
  const iconUrl = raster(abs(touch && attr(touch, "href")));
  const pdfs = [...new Set([...all.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => new URL(m[1], base).toString()))];
  return {
    url: base.toString(),
    logoUrl,
    iconUrl,
    /** prices on the page or a menu PDF: worth handing to Claude */
    hasMenu: (text.match(/\$\s?\d{1,3}(?:\.\d{2})?/g) ?? []).length >= 5 || pdfs.length > 0,
    title: home.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim(),
    text,
    themeColor: home.match(/name="theme-color"\s+content="([^"]+)"/i)?.[1],
    email: all.match(/mailto:([^"?]+)/i)?.[1],
    socials: [...new Set([...all.matchAll(/href="(https?:\/\/(?:www\.)?(?:instagram|facebook|tiktok)\.com\/[^"]+)"/gi)].map((m) => m[1]))],
    photos: images.map((u): Photo => ({ source: "website", url: u, owned: true })),
    menuPdfs: pdfs,
  };
}
