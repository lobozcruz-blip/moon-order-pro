import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Resuelve el id interno de un pedido a partir de su folio o su identificador. */
export async function resolveOrderId(
  supabase: Client,
  input: { folio?: string | undefined; order_id?: string | undefined },
): Promise<{ id: string; folio: string | null } | { error: string }> {
  const { folio, order_id } = input;
  if (!folio && !order_id) return { error: "Indica un folio o un order_id." };
  const query = supabase.from("orders").select("id, folio").limit(1);
  const { data, error } = await (order_id
    ? query.eq("id", order_id)
    : query.eq("folio", folio!)
  ).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No se encontró el pedido." };
  return { id: data.id, folio: data.folio };
}
