import { restaurant } from "@/config/restaurant";

// Lets links to this site open in the iPhone app once it's in the App Store (docs/16-app-stores.md).
export function GET() {
  const id = restaurant.app?.iosAppId;
  return Response.json({ applinks: { details: id ? [{ appIDs: [id], components: [{ "/": "/*" }] }] : [] } });
}
