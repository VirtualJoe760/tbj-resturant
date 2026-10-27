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

  return {
    url: base.toString(),
    title: home.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim(),
    text: pages.map(strip).join("\n\n").slice(0, 60000),
    themeColor: home.match(/name="theme-color"\s+content="([^"]+)"/i)?.[1],
    email: all.match(/mailto:([^"?]+)/i)?.[1],
    socials: [...new Set([...all.matchAll(/href="(https?:\/\/(?:www\.)?(?:instagram|facebook|tiktok)\.com\/[^"]+)"/gi)].map((m) => m[1]))],
    photos: images.map((u): Photo => ({ source: "website", url: u, owned: true })),
    menuPdfs: [...new Set([...all.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => new URL(m[1], base).toString()))],
  };
}
