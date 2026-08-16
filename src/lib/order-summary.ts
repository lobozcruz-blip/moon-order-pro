import type { Modality } from "@/lib/cm";

export type SummaryItem = {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  quantity: number;
  cutter_modality?: Modality | null;
  cutter_size_cm?: number | null;
  unit_price: number;
  subtotal: number;
  image_path?: string | null;
  image_url?: string | null;
  is_custom?: boolean;
  image_source?: "custom" | "catalog" | null;
};

export type SummaryOrderData = {
  id?: string;
  folio: string;
  created_at: string | Date;
  customer_name: string;
  delivery_type?: "envio" | "entrega_personal" | null;
  items: SummaryItem[];
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  total_paid?: number;
  balance?: number;
  is_paid?: boolean;
  due_date?: string | null;
  personal_delivery_place?: string | null;
  personal_delivery_time?: string | null;
};

export type OrderItemImageLike = {
  id?: string;
  storage_path: string | null;
  external_url?: string | null;
  is_primary?: boolean | null;
  image_type?: string | null;
  previewUrl?: string;
  file?: File;
};

export type ProductImageLike = {
  id?: string;
  storage_path: string | null;
  external_url?: string | null;
  is_primary?: boolean | null;
};

export type OrderItemLike = {
  id?: string;
  key?: string;
  product_name?: string;
  name?: string;
  product_sku?: string | null;
  sku?: string | null;
  category?: any;
  quantity?: number;
  cutter_modality?: any;
  cutter_size_cm?: number | null;
  unit_price?: number;
  subtotal?: number;
  notes?: string | null;
  is_custom?: boolean | null;
  order_item_images?: OrderItemImageLike[] | null;
  products?: {
    id?: string;
    sku?: string | null;
    name?: string | null;
    category?: string | null;
    product_images?: ProductImageLike[] | null;
  } | null;
  custom_images?: OrderItemImageLike[] | null;
  image_preview?: any | null;
};

/**
 * Resuelve la imagen a mostrar para un artículo siguiendo la regla de prioridad estricta en toda la app:
 * 1. Custom principal (is_primary = true)
 * 2. Primera imagen custom
 * 3. Imagen de catálogo principal
 * 4. Primera imagen del catálogo
 * 5. null / placeholder
 */
export function resolveOrderItemDisplayImage(item: OrderItemLike): {
  storagePath: string | null;
  externalUrl: string | null;
  isCustom: boolean;
  source: "custom" | "catalog" | null;
} {
  const customImages = ((item.order_item_images && item.order_item_images.length > 0)
    ? item.order_item_images
    : (item.custom_images ?? [])) as OrderItemImageLike[];

  const catalogImages = (((item.products?.product_images && item.products.product_images.length > 0)
    ? item.products.product_images
    : (item.image_preview ? [item.image_preview] : [])) ?? []) as ProductImageLike[];

  const isExplicitCustom = Boolean(item.is_custom);
  const hasCustomImages = customImages.length > 0;
  const isCustom = isExplicitCustom || hasCustomImages;

  // 1. Imagen custom principal
  const primaryCustom = customImages.find((img) => img.is_primary) ?? customImages[0];
  if (primaryCustom) {
    return {
      storagePath: primaryCustom.storage_path ?? null,
      externalUrl: primaryCustom.external_url ?? primaryCustom.previewUrl ?? null,
      isCustom: true,
      source: "custom",
    };
  }

  // 2. Imagen catálogo principal
  const primaryCatalog = catalogImages.find((img) => img.is_primary) ?? catalogImages[0];
  if (primaryCatalog) {
    return {
      storagePath: primaryCatalog.storage_path ?? null,
      externalUrl: primaryCatalog.external_url ?? null,
      isCustom,
      source: "catalog",
    };
  }

  return {
    storagePath: null,
    externalUrl: null,
    isCustom,
    source: null,
  };
}

/**
 * Única función encargada de transformar cualquier pedido completo de la base de datos o estado
 * en el formato unificado SummaryOrderData para el Resumen para Clienta.
 */
export function buildCustomerOrderSummary(order: any): SummaryOrderData {
  const rawItems = (order.order_items ?? order.items ?? []) as any[];

  const summaryItems: SummaryItem[] = rawItems.map((it: any, index: number) => {
    const resolved = resolveOrderItemDisplayImage(it);
    const qty = Number(it.quantity || 1);
    const price = Number(it.unit_price || 0);
    const lineSubtotal = Number(it.subtotal ?? (price * qty));

    return {
      id: it.id || it.key || `item-${index}-${it.product_name || it.name}`,
      name: it.product_name || it.name || "Artículo",
      sku: it.product_sku || it.sku || it.products?.sku || null,
      category: it.category,
      quantity: qty,
      cutter_modality: it.cutter_modality as Modality | null,
      cutter_size_cm: it.cutter_size_cm ? Number(it.cutter_size_cm) : null,
      unit_price: price,
      subtotal: lineSubtotal,
      image_path: resolved.storagePath,
      image_url: resolved.externalUrl,
      is_custom: resolved.isCustom,
      image_source: resolved.source,
    };
  });

  const itemsSubtotal = summaryItems.reduce((acc, i) => acc + i.subtotal, 0);
  const subtotal = Number(order.subtotal ?? itemsSubtotal);
  const discount = Number(order.discount ?? 0);
  const shippingCost = Number(
    order.shipping_cost ?? order.shipping_details?.shipping_cost ?? 0,
  );
  const expectedTotal = Math.max(0, subtotal - discount + shippingCost);
  const total = Number(order.total ?? expectedTotal);

  if (order.total !== undefined && order.total !== null && Number(order.total) !== expectedTotal) {
    console.warn(
      `[order-summary] Inconsistencia en total de pedido ${order.folio || order.id}: DB=${order.total}, Calculado=${expectedTotal}`,
    );
  }

  const paymentsSum = order.payments?.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) ?? 0;
  const totalPaid = Number(order.total_paid ?? order.paid_amount ?? paymentsSum);
  const expectedBalance = Math.max(0, total - totalPaid);
  const balance = Number(order.balance ?? expectedBalance);

  const cust = order.customers || order.customer;
  const customerName =
    order.customer_name ||
    (cust
      ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim()
      : "Cliente");

  const personalDelivery = order.personal_delivery_details || order.delivery;

  return {
    id: order.id,
    folio: order.folio ?? "Pedido",
    created_at: order.created_at ?? new Date().toISOString(),
    customer_name: customerName || "Cliente",
    delivery_type: order.delivery_type ?? null,
    items: summaryItems,
    subtotal,
    discount,
    shipping_cost: shippingCost,
    total,
    total_paid: totalPaid,
    balance,
    is_paid: balance <= 0,
    due_date: order.due_date ?? null,
    personal_delivery_place: personalDelivery?.place ?? null,
    personal_delivery_time: personalDelivery?.delivery_time ?? null,
  };
}
