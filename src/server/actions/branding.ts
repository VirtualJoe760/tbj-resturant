"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { businessTheme } from "@/config/business-theme";
import { pruneMedia } from "@/server/media";
import { diffBranding, FONTS, fromBusinessTheme, inkFor } from "@/domain/branding";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const url = z.string().max(2000).refine((u) => u.startsWith("/") || u.startsWith("https://"), "Images must be uploaded or https links");
const fontId = z.enum(FONTS.map((f) => f.id) as [string, ...string[]]);

const BrandingInput = z.object({
  theme: z.object({ primary: hex, header: hex, bg: hex }),
  headingFont: fontId,
  bodyFont: fontId,
  logoUrl: url.nullable(),
  iconUrl: url.nullable(),
  banners: z.array(url).max(8),
});

/**
 * Saves Admin → Branding as overrides on top of src/config/business-theme.ts: only the fields that
 * differ from the file are stored, so saving the file's own values (or "Reset") clears them.
 */
export async function saveBranding(input: z.infer<typeof BrandingInput>): Promise<{ ok: boolean; message: string }> {
  await requireRole(ADMIN_ROLES);
  const parsed = BrandingInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the colors and images." };
  const b = parsed.data;
  const brandingOverrides = diffBranding({ ...b, theme: { ...b.theme, primaryInk: inkFor(b.theme.primary) } }, fromBusinessTheme(businessTheme));
  const db = await getDb();
  const row = await db.query.brand.findFirst({ where: eq(s.brand.id, "brand") });
  await db.update(s.brand).set({ settings: { ...(row?.settings ?? {}), brandingOverrides } }).where(eq(s.brand.id, "brand"));

  await pruneMedia();
  revalidatePath("/", "layout");
  return { ok: true, message: Object.keys(brandingOverrides).length ? "Saved. Phones pick up a new app icon the next time the app updates." : "Back to business-theme.ts." };
}
