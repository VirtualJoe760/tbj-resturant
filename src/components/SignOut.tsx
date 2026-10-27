"use client";
import { authClient } from "@/auth/client";

export function SignOut({ className = "row", label = "Sign out" }: { className?: string; label?: string }) {
  return (
    <button
      className={className}
      style={className === "row" ? { width: "100%", border: 0, cursor: "pointer", font: "inherit", color: "inherit" } : undefined}
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/login";
      }}
    >
      {label} <span className="muted">›</span>
    </button>
  );
}
