import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Ficha de la clienta ligada a la sesión actual. */
export function useMyCustomer() {
  return useQuery({
    queryKey: ["my-customer"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*, customer_addresses(*)")
        .eq("auth_user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 300_000,
  });
}

/** Catálogo visible para clientas. */
export function useShopCatalog() {
  return useQuery({
    queryKey: ["shop-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, sku, name, category, base_price, description, product_images(id, storage_path, external_url, is_primary, sort_order)",
        )
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 120_000,
  });
}

/** Pedidos de la clienta. */
export function useMyOrders(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, product_name, quantity, unit_price, subtotal)")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

/** Número de WhatsApp del negocio. */
export function useWhatsappNumber() {
  return useQuery({
    queryKey: ["setting", "whatsapp_number"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      return data?.value ?? "";
    },
    staleTime: 600_000,
  });
}

/** Pedidos entrantes de la tienda, pendientes de confirmar (personal). */
export function usePendingOrders() {
  return useQuery({
    queryKey: ["orders-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, customers(id, first_name, last_name, phone), order_items(id, product_name, quantity, unit_price, subtotal, cutter_modality, cutter_size_cm), shipping_details(*), personal_delivery_details(*)",
        )
        .eq("review_status", "pendiente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });
}
