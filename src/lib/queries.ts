import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Modality } from "./cm";

export type ProductTheme = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductThemeLink = {
  theme_id: string;
  product_themes: {
    id: string;
    name: string;
    active: boolean;
  };
};

export function useProductThemes(includeInactive = false) {
  return useQuery({
    queryKey: ["product-themes", includeInactive],
    queryFn: async () => {
      let q = supabase.from("product_themes").select("*").order("name");
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductTheme[];
    },
    staleTime: 120_000,
  });
}

export async function saveProductThemeLinks(productId: string, themeIds: string[]) {
  // Eliminar vínculos anteriores
  await supabase.from("product_theme_links").delete().eq("product_id", productId);
  if (themeIds.length === 0) return;

  const rows = themeIds.map((theme_id) => ({
    product_id: productId,
    theme_id,
  }));
  const { error } = await supabase.from("product_theme_links").insert(rows);
  if (error) throw error;
}

export async function createProductTheme(name: string) {
  const { data, error } = await supabase
    .from("product_themes")
    .insert({ name: name.trim(), active: true })
    .select()
    .single();
  if (error) throw error;
  return data as ProductTheme;
}

export async function updateProductTheme(id: string, patch: { name?: string; active?: boolean }) {
  const { data, error } = await supabase
    .from("product_themes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ProductTheme;
}

export async function deleteProductTheme(id: string) {
  const { error } = await supabase.from("product_themes").delete().eq("id", id);
  if (error) throw error;
}

export function useProducts(includeInactive = true) {
  return useQuery({
    queryKey: ["products", includeInactive],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(
          "*, product_images(id, storage_path, external_url, is_primary, sort_order, kind), product_theme_links(theme_id, product_themes(id, name, active))",
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
    .neq("review_status", "pendiente")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function useOrders() {
  return useQuery({ queryKey: ["orders"], queryFn: fetchOrders, staleTime: 15_000 });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          customers(*, customer_addresses(*)),
          order_items(*, order_item_images(*)),
          shipping_details(*),
          personal_delivery_details(*),
          payments(*, payment_attachments(*)),
          order_notes(*, note_attachments(*))
        `,
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 5_000,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
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
