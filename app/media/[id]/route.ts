import { getMedia } from "@/server/branding";

// Logos, app icons and banners uploaded in Admin → Branding. Ids never change content, so cache forever.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMedia(id);
  if (!m) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(m.data, "base64"), {
    headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
