"use client";
import { useActionState, useEffect } from "react";
import Link from "next/link";
import { joinWithInvite } from "@/server/actions/join";

export function JoinForm() {
  const [state, action, pending] = useActionState(joinWithInvite, null);
  useEffect(() => {
    if (state?.ok) window.location.href = "/staff";
  }, [state]);
  return (
    <form action={action}>
      <label className="field"><span>Invite code (from your text or email)</span><input name="code" required placeholder="HOOD-7Q2K" /></label>
      <label className="field"><span>Full name</span><input name="name" required autoComplete="name" /></label>
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
      <label className="field"><span>Mobile (for shift reminders)</span><input name="phone" type="tel" autoComplete="tel" /></label>
      <label className="field"><span>Choose a password</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
      {state && !state.ok && <div className="err">{state.message}</div>}
      <div style={{ margin: 16 }}><button className="btn center" disabled={pending}>{pending ? "Creating…" : "Create account"}</button></div>
      <p className="note">Already on the team? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
