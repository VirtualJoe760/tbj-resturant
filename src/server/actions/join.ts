"use server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { getDb, schema as s } from "@/db/client";

/** Invite-only staff sign-up: a valid code creates the account, the employee profile and a session. */
export async function joinWithInvite(_: unknown, form: FormData): Promise<{ ok: boolean; message: string } | null> {
  const db = await getDb();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const invite = await db.query.staffInvites.findFirst({ where: and(eq(s.staffInvites.code, code), isNull(s.staffInvites.usedAt)) });
  if (!invite) return { ok: false, message: "That invite code isn't valid or was already used." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? invite.name).trim();
  if (password.length < 8) return { ok: false, message: "Password needs at least 8 characters." };
  try {
    const r = await auth.api.signUpEmail({ body: { email, password, name } });
    await db.update(s.user).set({ role: "employee" }).where(eq(s.user.id, r.user.id));
    await db.insert(s.employees).values({ userId: r.user.id, name, position: invite.position, phone: String(form.get("phone") ?? "") || null });
    await db.update(s.staffInvites).set({ usedAt: new Date() }).where(eq(s.staffInvites.code, code));
  } catch (e) {
    return { ok: false, message: (e as Error).message || "Couldn't create the account." };
  }
  return { ok: true, message: "Welcome to the team!" };
}
