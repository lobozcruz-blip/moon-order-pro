import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Modality } from "./cm";

export function useProducts(includeInactive = true) {
  return useQuery({
    queryKey: ["products", includeInactive],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(
          "*, product_images(id, storage_path, external_url, is_primary, sort_order, kind)",
        )
        .order("created_at", { ascending: false });
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 120_000,
  });
}

export function useProductSalesCounts() {
  return useQuery({
    queryKey: ["product-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("product_id, quantity");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) if (r.product_id) map[r.product_id] = (map[r.product_id] ?? 0) + r.quantity;
      return map;
    },
    staleTime: 120_000,
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, customer_addresses(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 120_000,
  });
}


export function usePriceRules() {
  return useQuery({
    queryKey: ["cutter-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cutter_price_rules")
        .select("*")
        .order("modality")
        .order("size_cm");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function priceFor(
  rules: { modality: string; size_cm: number; price: number }[] | undefined,
  modality: Modality | null | undefined,
  size: number | null | undefined,
) {
  if (!rules || !modality || !size) return 0;
  return Number(rules.find((r) => r.modality === modality && r.size_cm === size)?.price ?? 0);
}

export type OrderRow = Awaited<ReturnType<typeof fetchOrders>>[number];

export async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, customers(id, first_name, last_name, phone), order_items(id, quantity, done_quantity, is_done, category)",
    )
    .eq("is_draft", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useOrders() {
  return useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, customers(*), order_items(*, order_item_images(*), products(id, sku, product_images(*))), order_notes(*, note_attachments(*)), payments(*, payment_attachments(*)), shipping_details(*), personal_delivery_details(*)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useActivity(orderId?: string) {
  return useQuery({
    queryKey: ["activity", orderId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(orderId ? 200 : 60);
      if (orderId) q = q.eq("order_id", orderId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export async function nextSku(category: Category) {
  const prefix = { CORTADORES: "COR", STENCILS: "STE", CAJAS: "CAJ", OTROS: "OTR" }[category];
  const { data } = await supabase
    .from("products")
    .select("sku")
    .like("sku", `${prefix}-%`)
    .order("sku", { ascending: false })
    .limit(1);
  const last = data?.[0]?.sku ?? `${prefix}-0000`;
  const n = parseInt(last.split("-")[1] ?? "0", 10) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
