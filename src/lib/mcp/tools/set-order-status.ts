import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveOrderId } from "../resolve-order";

export default defineTool({
  name: "set_order_status",
  title: "Cambiar estado del pedido",
  description:
    "Cambia el estado de un pedido de Cookies Moon (en_espera, en_preparacion, enviado, finalizado, pausado, cancelado) buscándolo por folio o identificador.",
  inputSchema: {
    folio: z.string().trim().optional().describe("Folio del pedido, por ejemplo CM-2026-0007."),
    order_id: z.string().uuid().optional().describe("Identificador interno del pedido."),
    status: z
      .enum(["en_espera", "en_preparacion", "enviado", "finalizado", "pausado", "cancelado"])
      .describe("Nuevo estado del pedido."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ folio, order_id, status }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const resolved = await resolveOrderId(supabase, { folio, order_id });
    if ("error" in resolved)
      return { content: [{ type: "text", text: resolved.error }], isError: true };

    const { data: prev } = await supabase
      .from("orders")
      .select("status")
      .eq("id", resolved.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", resolved.id)
      .select("id, folio, status, payment_status, total, balance")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    await supabase.from("activity_log").insert({
      user_id: ctx.getUserId() ?? null,
      action: "cambio_estado_agente",
      entity: "orders",
      order_id: resolved.id,
      old_value: prev?.status ?? null,
      new_value: status,
      detail: "Estado cambiado desde el agente",
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { order: data },
    };
  },
});
