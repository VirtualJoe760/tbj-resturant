"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { alertsSeenAt, markAlertsSeen, setUnread, trackedOrders, useTrackedVersion } from "@/components/alerts-store";

interface Alert { id: string; title: string; body: string; url: string | null; createdAt: string }

// Site-wide: while a followed order is live, checks for updates every 6 s and drops a banner at the
// top of whatever page the customer is on ("We started your order", "Ready for pickup").
export function OrderAlerts() {
  const [shown, setShown] = useState<Alert | null>(null);
  const queue = useRef<Alert[]>([]);
  const [queued, setQueued] = useState(0);
  // re-check after each page change and whenever an order is placed, in case polling had stopped
  const path = usePathname();
  const version = useTrackedVersion();

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const ids = trackedOrders();
      try {
        const r = await fetch(`/api/updates?orders=${ids.join(",")}&after=${encodeURIComponent(alertsSeenAt())}`, { cache: "no-store" });
        if (stop) return; // a newer check took over (page change)
        if (r.ok) {
          const data: { items: Alert[]; unread: number; live: unknown[] } = await r.json();
          setUnread(data.unread ?? 0);
          if (data.items.length) {
            markAlertsSeen(data.items[0].createdAt);
            queue.current.push(...data.items.reverse());
            setQueued(queue.current.length);
          }
          if (stop || !data.live.length) return; // nothing cooking: stop until the next page or order
        }
      } catch {}
      if (!stop) timer = setTimeout(tick, 6000);
    };
    // first visit: don't replay old alerts as pop-ups
    if (alertsSeenAt() === new Date(0).toISOString()) markAlertsSeen();
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [path, version]);

  // one banner at a time: show the next queued alert, keep each up for 7 s
  useEffect(() => {
    if (shown || !queue.current.length) return;
    setShown(queue.current.shift()!);
    setQueued(queue.current.length);
  }, [shown, queued]);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 7000);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  return (
    <div className="order-alert" role="status" aria-live="polite">
      <Link href={shown.url ?? "/account"} onClick={() => setShown(null)}>
        <b>{shown.title}</b>
        {shown.body && <span>{shown.body}</span>}
      </Link>
      <button aria-label="Dismiss" onClick={() => setShown(null)}>✕</button>
    </div>
  );
}
