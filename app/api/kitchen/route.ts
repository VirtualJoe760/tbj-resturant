import { NextResponse } from "next/server";
import { getUser, KITCHEN_ROLES } from "@/auth/session";
import { getKitchenOrders } from "@/server/queries";

export async function GET() {
  const u = await getUser();
  if (!u || !KITCHEN_ROLES.includes(u.role)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getKitchenOrders());
}
