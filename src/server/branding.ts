import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import { restaurant } from "@/config/restaurant";
import { businessTheme } from "@/config/business-theme";
import { fromBusinessTheme, resolveBranding, type Branding, type BrandingOverrides } from "@/domain/branding";

export interface Brand extends Branding {
  name: string;
  shortName: string;
  tagline: string;
  /** The look from business-theme.ts alone, before any Admin → Branding changes. */
  base: Branding;
  overridden: (keyof Branding)[];
}

/** The restaurant's name and look, read once per request. */
export const getBrand = cache(async (): Promise<Brand> => {
  const db = await getDb();
  const row = await db.query.brand.findFirst({ where: eq(s.brand.id, "brand") });
  const settings = (row?.settings ?? {}) as { shortName?: string; brandingOverrides?: BrandingOverrides };
  const base = fromBusinessTheme(businessTheme);
  const overrides = settings.brandingOverrides ?? {};
  return {
    ...resolveBranding(overrides, base),
    base,
    overridden: Object.keys(overrides) as (keyof Branding)[],
    name: row?.name ?? restaurant.name,
    shortName: settings.shortName ?? restaurant.shortName,
    tagline: restaurant.tagline,
  };
});

export async function getMedia(id: string) {
  const db = await getDb();
  return db.query.media.findFirst({ where: eq(s.media.id, id) });
}

export const mediaUrl = (id: string) => `/media/${id}`;

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Bytes for an image URL the site owns: "/media/<id>" (uploaded) or "/brand/…" (public/brand). */
export async function readOwnImage(url: string): Promise<{ mime: string; data: string } | null> {
  const id = url.match(/^\/media\/([\w-]+)$/)?.[1];
  if (id) return (await getMedia(id)) ?? null;
  if (!url.startsWith("/brand/") || url.includes("..")) return null;
  const file = path.join(process.cwd(), "public", url);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime || !fs.existsSync(file)) return null;
  return { mime, data: fs.readFileSync(file).toString("base64") };
}

/** Short tag that changes whenever the icon changes, so phones fetch the new one. */
export function iconVersion(url: string) {
  const id = url.match(/^\/media\/([\w-]+)$/)?.[1];
  if (id) return id.slice(0, 8);
  try { return String(Math.round(fs.statSync(path.join(process.cwd(), "public", url)).mtimeMs / 1000) % 1e8); } catch { return "0"; }
}
