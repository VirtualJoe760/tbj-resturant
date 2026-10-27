"use client";
import { useSyncExternalStore } from "react";

// Orders this phone is following (so guests get alerts too) and the unread-alert count shown on
// the Account tab. Kept in localStorage, like the cart.
const ORDERS = "tracked-orders";
const SEEN = "alerts-seen-at";

const read = <T,>(k: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export const trackedOrders = (): string[] => read<string[]>(ORDERS, []);

/** Follow an order's alerts on this device (newest 10 kept). */
export function trackOrder(id: string) {
  const had = trackedOrders()[0] === id;
  write(ORDERS, [id, ...trackedOrders().filter((x) => x !== id)].slice(0, 10));
  if (!had) {
    tracked++;
    listeners.forEach((l) => l()); // wakes the alert checker up
  }
}

export const alertsSeenAt = () => read<string>(SEEN, new Date(0).toISOString());
export const markAlertsSeen = (iso = new Date().toISOString()) => write(SEEN, iso);

let unread = 0;
let tracked = 0;
const listeners = new Set<() => void>();
export function setUnread(n: number) {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
}
/** Changes whenever a new order is followed. */
export const useTrackedVersion = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => tracked, () => 0);

export const useUnreadAlerts = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => unread, () => 0);
