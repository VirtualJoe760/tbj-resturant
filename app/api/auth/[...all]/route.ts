import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/auth";
import { ready } from "@/db/client";

const h = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ready();
  return h.GET(req);
}
export async function POST(req: Request) {
  await ready();
  return h.POST(req);
}
