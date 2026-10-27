import "server-only";
import { and, eq, lt, notInArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db/client";
import type { BrandingOverrides } from "@/domain/branding";

const mediaIdOf = (u: string | null | undefined) => u?.match(/^\/media\/([\w-]+)$/)?.[1];

/** Deletes uploads nothing points at any more (left an hour, so an upload mid-edit isn't lost). */
export async function pruneMedia() {
  const db = await getDb();
  const brand = await db.query.brand.findFirst({ where: eq(s.brand.id, "brand") });
  const o = ((brand?.settings ?? {}) as { brandingOverrides?: BrandingOverrides }).brandingOverrides ?? {};
  const itemImages = (await db.select({ images: s.items.images }).from(s.items)).flatMap((r) => r.images);
  const keep = [o.logoUrl, o.iconUrl, ...(o.banners ?? []), ...(o.gallery ?? []).map((g) => g.src), ...itemImages].map(mediaIdOf).filter((x): x is string => !!x);
  const hourAgo = new Date(Date.now() - 3600_000);
  await db.delete(s.media).where(keep.length ? and(notInArray(s.media.id, keep), lt(s.media.createdAt, hourAgo)) : lt(s.media.createdAt, hourAgo));
}
