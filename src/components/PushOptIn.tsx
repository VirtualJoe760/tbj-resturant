"use client";
import { useEffect, useState } from "react";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type State = "unsupported" | "ask" | "on" | "blocked" | "busy" | "ios-install";

/**
 * "Notify me" button: phone notifications when the kitchen starts and finishes the order (and for
 * deliveries, when the driver picks it up). iPhones only allow this once the site is added to the
 * home screen, so there we say how.
 */
export function PushOptIn({ orderId, label = "Notify me when it's started and ready" }: { orderId?: string; label?: string }) {
  const [state, setState] = useState<State>("busy");

  useEffect(() => {
    const ios = /iphone|ipad/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (!sub || Notification.permission !== "granted") return setState("ask");
      // already allowed on this phone: just add this order to it
      if (orderId) await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), orderId }) }).catch(() => {});
      setState("on");
    });
  }, [orderId]);

  const enable = async () => {
    setState("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push")).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), orderId }) });
      setState(r.ok ? "on" : "ask");
    } catch {
      setState("ask");
    }
  };

  if (state === "unsupported") return null;
  if (state === "ios-install") return <p className="note">🔔 On iPhone, tap Share → <b>Add to Home Screen</b>, open the app from there, and you can get a notification when your order is started and ready.</p>;
  if (state === "blocked") return <p className="note">🔕 Notifications are off for this site in your browser settings. This page still updates live.</p>;
  if (state === "on") return <p className="note">🔔 Notifications are on for this phone.</p>;
  return (
    <div className="chips">
      <button className="on" onClick={enable} disabled={state === "busy"}>🔔 {label}</button>
    </div>
  );
}
