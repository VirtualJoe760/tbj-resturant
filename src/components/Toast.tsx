"use client";
import { useEffect, useState } from "react";

// Tiny global toast: call toast("Saved") from any client component.
let push: ((m: string) => void) | null = null;
export const toast = (m: string) => push?.(m);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    push = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      push = null;
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
