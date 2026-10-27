import { ImageResponse } from "next/og";
import { restaurant } from "@/config/restaurant";

// App icon generated from brand colors until the client's logo is added to /brand.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: restaurant.theme.header, color: restaurant.theme.primary, fontSize: 192 * 0.42, fontWeight: 900 }}>
        {restaurant.shortName.replace(/^The\s+/i, "").slice(0, 1)}
      </div>
    ),
    { width: 192, height: 192 },
  );
}
