import { z } from "zod";
import { getUser } from "@/auth/session";
import { pushPublicKey, savePushSubscription } from "@/server/notify";

// Phone notifications (Web Push): GET gives the public key the browser needs to subscribe,
// POST saves the subscription for the signed-in customer and/or one order (guests).
export async function GET() {
  return Response.json({ publicKey: await pushPublicKey() });
}

const Body = z.object({
  subscription: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  orderId: z.string().regex(/^[\w-]{8,64}$/).optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false }, { status: 400 });
  const user = await getUser();
  if (!user && !body.data.orderId) return Response.json({ ok: false }, { status: 400 });
  await savePushSubscription(body.data.subscription, { userId: user?.id, orderId: body.data.orderId });
  return Response.json({ ok: true });
}
