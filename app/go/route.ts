import { NextResponse } from "next/server";
import { getUser, landingFor } from "@/auth/session";

// After sign-in: send each account type to its home (or back to where it came from).
// Redirects keep the browser's own host (e.g. admin.localhost) so the session cookie still applies.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host}`;
  const u = await getUser();
  if (!u) return NextResponse.redirect(new URL("/login", origin));
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return NextResponse.redirect(new URL(safeNext ?? landingFor(u.role), origin));
}
