import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveOrderId } from "../resolve-order";

export default defineTool({
  name: "update_order_meta",
  title: "Cambiar prioridad o fecha de entrega",
  description:
    "Ajusta la prioridad y/o la fecha comprometida de entrega de un pedido de Cookies Moon.",
  inputSchema: {
    folio: z.string().trim().optional().describe("Folio del pedido, por ejemplo CM-2026-0007."),
    order_id: z.string().uuid().optional().describe("Identificador interno del pedido."),
    priority: z
      .enum(["baja", "normal", "alta", "urgente"])
      .optional()
      .describe("Nueva prioridad del pedido."),
    due_date: z.string().trim().optional().describe("Fecha de entrega en formato AAAA-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ folio, order_id, priority, due_date }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    if (!priority && due_date === undefined)
      return {
        content: [{ type: "text", text: "Indica priority o due_date." }],
        isError: true,
      };
    const supabase = supabaseForUser(ctx);
    const resolved = await resolveOrderId(supabase, { folio, order_id });
    if ("error" in resolved)
      return { content: [{ type: "text", text: resolved.error }], isError: true };

    const patch: { priority?: "baja" | "normal" | "alta" | "urgente"; due_date?: string | null } = {};
    if (priority) patch.priority = priority;
    if (due_date !== undefined) patch.due_date = due_date.trim() || null;

    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", resolved.id)
      .select("id, folio, priority, due_date, status")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    await supabase.from("activity_log").insert({
      user_id: ctx.getUserId() ?? null,
      action: "ajuste_agente",
      entity: "orders",
      order_id: resolved.id,
      new_value: JSON.stringify(patch),
      detail: "Prioridad o fecha actualizada desde el agente",
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { order: data },
    };
  },
});
