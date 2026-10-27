"use client";
import { useSyncExternalStore } from "react";
import type { Selections } from "@/domain/pricing";

// Cart lives in the browser until checkout; the server re-prices everything on submit.
export interface StoredLine {
  key: string;
  itemId: string;
  name: string;
  emoji: string;
  quantity: number;
  unitCents: number;
  selections: Selections;
  modifiers: string[];
  instructions?: string;
}

const KEY = "cart-v1";
let cache: StoredLine[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: StoredLine[] = [];

function read(): StoredLine[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(lines: StoredLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {}
  listeners.forEach((l) => l());
}

export const cart = {
  get: read,
  add(line: Omit<StoredLine, "key">) {
    write([...read(), { ...line, key: crypto.randomUUID() }]);
  },
  setQty(key: string, quantity: number) {
    write(read().map((l) => (l.key === key ? { ...l, quantity } : l)).filter((l) => l.quantity > 0));
  },
  clear() {
    write([]);
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useCart() {
  return useSyncExternalStore(cart.subscribe, read, () => EMPTY);
}

export function useCartCount() {
  return useCart().reduce((a, l) => a + l.quantity, 0);
}
