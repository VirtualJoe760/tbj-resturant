"use client";
import { useState } from "react";
import { authClient } from "@/auth/client";

interface Props {
  next?: string;
  tests: { email: string; label: string; note: string }[];
  testPassword: string;
  social: { google: boolean; facebook: boolean };
}

export function LoginClient({ next, tests, testPassword, social }: Props) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dest = `/go${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = mode === "in"
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
    setBusy(false);
    if (r.error) return setErr(r.error.message ?? "Email or password doesn't match.");
    window.location.href = dest; // full load so every layout picks up the new session
  };

  const socialSignIn = (provider: "google" | "facebook") => authClient.signIn.social({ provider, callbackURL: dest });

  return (
    <form onSubmit={submit}>
      <div className="chips" style={{ marginTop: 14 }}>
        <button type="button" className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>Sign in</button>
        <button type="button" className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>Create account</button>
      </div>
      {mode === "up" && <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
      <label className="field"><span>Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
      <label className="field"><span>Password</span><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
      {err && <div className="err">{err}</div>}
      <div style={{ margin: "10px 16px" }}><button className="btn center" disabled={busy}>{busy ? "One sec…" : mode === "in" ? "Sign in" : "Create account"}</button></div>
      {mode === "in" && <p className="note">Forgot your password? Ask the restaurant to resend your invite, or create a new account.</p>}

      <div className="or">or</div>
      <button type="button" className="social" disabled={!social.google} onClick={() => socialSignIn("google")}>
        <b style={{ color: "#4285F4" }}>G</b> Continue with Google {!social.google && <small className="muted">· at launch</small>}
      </button>
      <button type="button" className="social" disabled={!social.facebook} onClick={() => socialSignIn("facebook")}>
        <b style={{ color: "#1877F2" }}>f</b> Continue with Facebook {!social.facebook && <small className="muted">· at launch</small>}
      </button>

      {tests.length > 0 && (
        <>
          <div className="sec">Test accounts (demo only)</div>
          <div className="testacct">
            {tests.map((t) => (
              <button type="button" key={t.email} onClick={() => { setMode("in"); setEmail(t.email); setPassword(testPassword); setErr(""); }}>
                <b>{t.label}</b><small>{t.email}</small><small>{t.note}</small>
              </button>
            ))}
          </div>
          <p className="note">Tap one to fill the form, then Sign in. These accounts are switched off when the site goes live.</p>
        </>
      )}
    </form>
  );
}
