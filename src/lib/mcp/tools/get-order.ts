import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_order",
  title: "Ver detalle de pedido",
  description:
    "Devuelve el detalle completo de un pedido de Cookies Moon (artículos, avance de producción, pagos, notas y datos de entrega) buscándolo por folio o por identificador.",
  inputSchema: {
    folio: z.string().trim().optional().describe("Folio del pedido, por ejemplo CM-2026-0007."),
    order_id: z.string().uuid().optional().describe("Identificador interno del pedido."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ folio, order_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    if (!folio && !order_id)
      return { content: [{ type: "text", text: "Indica un folio o un order_id." }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("orders")
      .select(
        "*, customers(first_name, last_name, phone, contact_channel), order_items(product_name, category, quantity, done_quantity, is_done, unit_price, subtotal, cutter_modality, cutter_size_cm, notes), payments(amount, paid_at, method, reference), order_notes(title, body, important, created_at), shipping_details(*), personal_delivery_details(*)",
      )
      .limit(1);
    q = order_id ? q.eq("id", order_id) : q.eq("folio", folio!);
    const { data, error } = await q.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "No se encontró el pedido." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { order: data },
    };
  },
});
