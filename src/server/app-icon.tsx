import "server-only";
import { ImageResponse } from "next/og";
import { getBrand, readOwnImage } from "./branding";

/**
 * The app icon at any size: the icon from business-theme.ts (or Admin → Branding) when there is one, otherwise the first letter of the
 * name on the brand colors. `maskable` is the Android adaptive icon, which may be cropped to a
 * circle: an uploaded icon fills it edge to edge (its subject is asked to sit in the middle), the
 * letter is kept inside the safe middle 80%. `opaque` fills the background, as iOS requires.
 */
export async function appIcon(size: number, opts: { maskable?: boolean; opaque?: boolean; rounded?: boolean } = {}) {
  const brand = await getBrand();
  const media = brand.iconUrl ? await readOwnImage(brand.iconUrl) : null;
  const pad = opts.maskable && !media ? Math.round(size * 0.1) : 0;
  const bg = opts.maskable || opts.opaque || !media ? brand.theme.header : "transparent";
  const inner = size - pad * 2;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: bg, borderRadius: opts.rounded ? size * 0.22 : 0 }}>
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:${media.mime};base64,${media.data}`} width={inner} height={inner} alt="" style={{ objectFit: "cover", borderRadius: opts.rounded && !pad ? size * 0.22 : 0 }} />
        ) : (
          <span style={{ color: brand.theme.primary, fontSize: inner * 0.62, fontWeight: 900 }}>{brand.shortName.replace(/^The\s+/i, "").slice(0, 1).toUpperCase()}</span>
        )}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
