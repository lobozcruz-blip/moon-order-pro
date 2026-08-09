import { useSyncExternalStore } from "react";
import type { Category, Modality } from "./cm";

export type CartLine = {
  key: string;
  product_id: string;
  sku: string;
  name: string;
  category: Category;
  modality: Modality | null;
  size_cm: number | null;
  quantity: number;
  unit_price: number;
  storage_path: string | null;
  external_url: string | null;
};

const KEY = "cm-cart-v1";
let lines: CartLine[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function load() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) lines = JSON.parse(raw) as CartLine[];
  } catch {
    lines = [];
  }
}

function persist() {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(lines));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: CartLine[] = [];
function getSnapshot() {
  load();
  return lines;
}
function getServerSnapshot() {
  return EMPTY;
}

export function lineKey(productId: string, modality: Modality | null, size: number | null) {
  return [productId, modality ?? "", size ?? ""].join("|");
}

export const cart = {
  add(line: Omit<CartLine, "key">) {
    load();
    const key = lineKey(line.product_id, line.modality, line.size_cm);
    const found = lines.find((l) => l.key === key);
    if (found) {
      lines = lines.map((l) =>
        l.key === key ? { ...l, quantity: l.quantity + line.quantity, unit_price: line.unit_price } : l,
      );
    } else {
      lines = [...lines, { ...line, key }];
    }
    persist();
  },
  setQuantity(key: string, quantity: number) {
    load();
    lines =
      quantity <= 0
        ? lines.filter((l) => l.key !== key)
        : lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(999, quantity) } : l));
    persist();
  },
  remove(key: string) {
    load();
    lines = lines.filter((l) => l.key !== key);
    persist();
  },
  clear() {
    lines = [];
    persist();
  },
};

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = items.reduce((a, l) => a + l.quantity, 0);
  const total = items.reduce((a, l) => a + l.quantity * l.unit_price, 0);
  return { items, count, total };
}
