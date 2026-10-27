import { ADMIN_ROLES, getUser } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { mediaUrl } from "@/server/branding";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024; // images are resized in the browser first, so this is generous

/** Upload one image (multipart field "file", plus optional width/height). */
export async function POST(req: Request) {
  const u = await getUser();
  if (!u || !ADMIN_ROLES.includes(u.role)) return Response.json({ error: "Sign in as an owner to upload." }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !TYPES.includes(file.type)) return Response.json({ error: "Use a PNG, JPG or WebP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That image is too large (3 MB max)." }, { status: 400 });
  const db = await getDb();
  const [row] = await db.insert(s.media).values({
    mime: file.type, data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    width: Number(form.get("width")) || null, height: Number(form.get("height")) || null,
  }).returning({ id: s.media.id });
  return Response.json({ id: row.id, url: mediaUrl(row.id) });
}
