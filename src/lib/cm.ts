import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Enums"]["product_category"];
export type Modality = Database["public"]["Enums"]["cutter_modality"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type Priority = Database["public"]["Enums"]["order_priority"];
export type DeliveryType = Database["public"]["Enums"]["delivery_type"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const CATEGORIES: Category[] = ["CORTADORES", "STENCILS", "CAJAS", "OTROS"];

export const CATEGORY_META: Record<Category, { label: string; token: string; prefix: string }> = {
  CORTADORES: { label: "Cortadores", token: "cat-cortadores", prefix: "COR" },
  STENCILS: { label: "Stencils", token: "cat-stencils", prefix: "STE" },
  CAJAS: { label: "Cajas", token: "cat-cajas", prefix: "CAJ" },
  OTROS: { label: "Otros", token: "cat-otros", prefix: "OTR" },
};

export const MODALITIES: { value: Modality; label: string }[] = [
  { value: "cutter_only", label: "Solo cortador" },
  { value: "cutter_with_stamp", label: "Cortador con sello" },
];

export const SIZES = Array.from({ length: 16 }, (_, i) => i + 5);

export const ORDER_STATUSES: OrderStatus[] = [
  "en_espera",
  "en_preparacion",
  "enviado",
  "finalizado",
  "pausado",
  "cancelado",
];

export const STATUS_META: Record<OrderStatus, { label: string; token: string; icon: string }> = {
  en_espera: { label: "En espera", token: "st-espera", icon: "⏳" },
  en_preparacion: { label: "En preparación", token: "st-preparacion", icon: "🛠" },
  enviado: { label: "Enviado", token: "st-enviado", icon: "🚚" },
  finalizado: { label: "Finalizado", token: "st-finalizado", icon: "✅" },
  pausado: { label: "Pausado", token: "st-pausado", icon: "⏸" },
  cancelado: { label: "Cancelado", token: "st-cancelado", icon: "✕" },
};

export const KANBAN_STATUSES: OrderStatus[] = [
  "en_espera",
  "en_preparacion",
  "enviado",
  "finalizado",
];

export const PAYMENT_META: Record<PaymentStatus, { label: string; token: string }> = {
  sin_pago: { label: "Sin pagar", token: "st-cancelado" },
  pago_parcial: { label: "Con adelanto", token: "st-pausado" },
  pagado: { label: "Pagado", token: "st-finalizado" },
  reembolso: { label: "Reembolso", token: "st-enviado" },
  cancelado: { label: "Cancelado", token: "st-espera" },
};

export function getOrderPaymentCategory(order: {
  payment_status?: string | null;
  paid_amount?: number | null;
  total?: number | null;
  balance?: number | null;
  status?: string | null;
}): "sin_pago" | "pago_parcial" | "pagado" {
  const paid = Number(order.paid_amount || 0);
  const total = Number(order.total || 0);
  const bal = Number(order.balance ?? (total - paid));

  if (paid <= 0) return "sin_pago";
  if (bal <= 0) return "pagado";
  return "pago_parcial";
}

export function compareOrderPriority(a: { priority: string; due_date: string | null; created_at: string }, b: { priority: string; due_date: string | null; created_at: string }) {
  const rank: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baja: 3 };
  return (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2)
    || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
    || a.created_at.localeCompare(b.created_at);
}

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const CONTACT_CHANNELS = [
  "WhatsApp",
  "Facebook",
  "Instagram",
  "Tienda en línea",
  "Recomendación",
  "Otro",
];

export const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Tarjeta", "Depósito", "Otro"];

export const OVERRIDE_REASONS = [
  "Descuento autorizado",
  "Precio especial",
  "Reposición",
  "Promoción",
  "Ajuste manual",
];

export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n ?? 0));

export const dateFmt = (d: string | null | undefined) =>
  d ? new Date(d.length <= 10 ? d + "T12:00:00" : d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const dateTimeFmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

export const whatsappLink = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.length === 10 ? "52" + digits : digits}`;
};

export const fullName = (a?: string | null, b?: string | null) =>
  [a, b].filter(Boolean).join(" ").trim() || "Sin nombre";
