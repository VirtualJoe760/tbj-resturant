import { ImageResponse } from "next/og";
import { restaurant } from "@/config/restaurant";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: restaurant.theme.header, color: restaurant.theme.primary, fontSize: 40, fontWeight: 900, borderRadius: 14 }}>
      {restaurant.shortName.replace(/^The\s+/i, "").slice(0, 1)}
    </div>,
    size,
  );
}
