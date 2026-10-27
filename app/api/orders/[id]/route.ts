import { NextResponse } from "next/server";
import { getOrder } from "@/server/queries";
import { refreshDelivery } from "@/server/delivery-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await refreshDelivery(id);
  const o = await getOrder(id);
  if (!o) return NextResponse.json({ error: "not found" }, { status: 404 });
  // public status page: no phone/email in the response
  const { customerPhone: _p, customerEmail: _e, customerUserId: _u, ...safe } = o;
  return NextResponse.json(safe);
}
