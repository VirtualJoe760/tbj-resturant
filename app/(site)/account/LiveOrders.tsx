"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { setUnread } from "@/components/alerts-store";

/**
 * Keeps the dashboard current: marks alerts as read, and refreshes the page while an order is
 * cooking or on its way so the status chips and "Updates" list move by themselves.
 */
export function LiveRefresh({ live }: { live: boolean }) {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/updates", { method: "POST" }).then(() => setUnread(0)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [live, router]);
  return null;
}

export function LiveOrderCard({ id, number, label, detail, progress }: { id: string; number: string; label: string; detail: string; progress: number }) {
  const prev = useRef(label);
  const changed = prev.current !== label;
  prev.current = label;
  return (
    <Link className={`live-order ${changed ? "pulse" : ""}`} href={`/order/${id}`}>
      <div className="lo-top"><b>#{number} · {label}</b><span>›</span></div>
      <div className="mods">{detail}</div>
      <div className="lo-bar"><i style={{ width: `${Math.max(8, progress * 100)}%` }} /></div>
    </Link>
  );
}
