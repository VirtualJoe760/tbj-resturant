// Google listing photos for demo sites. Google asks that its photos be shown through its own
// photo service rather than copied, and its key must never reach the browser, so this asks Google
// for a short-lived public link and redirects there. Needs GOOGLE_PLACES_API_KEY on the server.
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return new Response("not found", { status: 404 });
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1600&skipHttpRedirect=true`, { headers: { "X-Goog-Api-Key": key } });
  const photoUri = res.ok ? ((await res.json()) as { photoUri?: string }).photoUri : undefined;
  if (!photoUri) return new Response("not found", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: photoUri, "Cache-Control": "public, max-age=3600" } });
}
