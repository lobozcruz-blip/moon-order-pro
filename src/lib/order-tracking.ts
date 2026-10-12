// Labels use dedicated order_notes entries, preserving the existing access policies.
export const ORDER_LABEL_TITLE = "[moon:order-label:v1]";

export type OrderLabelNote = { id: string; title: string | null; body: string | null };

export function normalizeOrderLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");
}

export function orderLabels(notes: OrderLabelNote[] | undefined) {
  return (notes ?? []).filter(n => n.title === ORDER_LABEL_TITLE && !!n.body?.trim());
}

export function productionProgress(items: { quantity: number; done_quantity: number; is_done: boolean }[] | undefined) {
  let total = 0;
  let done = 0;
  for (const item of items ?? []) {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    total += quantity;
    done += item.is_done ? quantity : Math.min(quantity, Math.max(0, Number(item.done_quantity) || 0));
  }
  return { total, done, percent: total ? Math.round(done / total * 100) : 0 };
}

export function confirmedReceivable(order: { total: number; paid_amount: number; balance: number | null; status: string; is_draft?: boolean; review_status?: string }) {
  if (order.status === "cancelado" || order.is_draft || order.review_status === "pendiente" || Number(order.paid_amount) <= 0) return 0;
  return Math.max(0, Number(order.balance ?? (order.total - order.paid_amount)) || 0);
}
