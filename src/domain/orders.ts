// Order state machine. Transitions only happen through `canTransition` / `nextStatuses`.

export const ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "paid",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "expired",
  "refunded",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["pending_payment", "accepted", "cancelled"], // accepted = voice pay-at-pickup
  pending_payment: ["paid", "expired", "cancelled"],
  paid: ["accepted", "preparing", "refunded", "cancelled"],
  accepted: ["preparing", "cancelled", "refunded"],
  preparing: ["ready", "cancelled", "refunded"],
  ready: ["completed", "refunded"],
  completed: ["refunded"],
  expired: [],
  refunded: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Kitchen columns: what the kitchen sees and the one button it gets. */
export const KITCHEN_FLOW: Partial<Record<OrderStatus, { column: "new" | "preparing" | "ready"; next: OrderStatus; button: string }>> = {
  paid: { column: "new", next: "preparing", button: "Start" },
  accepted: { column: "new", next: "preparing", button: "Start" },
  preparing: { column: "preparing", next: "ready", button: "Ready" },
  ready: { column: "ready", next: "completed", button: "Picked up" },
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_payment: "Waiting for payment",
  paid: "Received",
  accepted: "Received",
  preparing: "In the oven",
  ready: "Ready for pickup",
  completed: "Picked up",
  expired: "Expired",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/** Short daily order number like A042. */
export function orderNumber(seq: number) {
  return "A" + String(seq).padStart(3, "0");
}
