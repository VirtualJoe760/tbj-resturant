import { NextResponse } from "next/server";
import { getUser, landingFor } from "@/auth/session";

// After sign-in: send each account type to its home (or back to where it came from).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = await getUser();
  if (!u) return NextResponse.redirect(new URL("/login", url));
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return NextResponse.redirect(new URL(safeNext ?? landingFor(u.role), url));
}
