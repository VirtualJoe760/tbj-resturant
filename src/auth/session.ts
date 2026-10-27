import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ready } from "@/db/client";
import { auth } from "./auth";

export type Role = "admin" | "manager" | "employee" | "kitchen" | "customer" | "webmaster";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isTestAccount: boolean;
}

const WEBMASTERS = (process.env.WEBMASTER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function getUser(): Promise<SessionUser | null> {
  await ready();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; isTestAccount?: boolean };
  const role = (WEBMASTERS.includes(u.email.toLowerCase()) ? "webmaster" : u.role ?? "customer") as Role;
  return { id: u.id, name: u.name, email: u.email, role, isTestAccount: !!u.isTestAccount };
}

export const ADMIN_ROLES: Role[] = ["webmaster", "admin", "manager"];
export const KITCHEN_ROLES: Role[] = [...ADMIN_ROLES, "kitchen"];

export const landingFor = (role: Role) =>
  ADMIN_ROLES.includes(role) ? "/admin" : role === "kitchen" ? "/kitchen" : role === "employee" ? "/staff" : "/account";

/** Server-side gate. The UI hides things too, but this is the real check. */
export async function requireRole(roles: Role[], from = "/"): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(from)}`);
  if (!roles.includes(u.role)) redirect(landingFor(u.role));
  return u;
}
