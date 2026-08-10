import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveOrderId } from "../resolve-order";

export default defineTool({
  name: "update_item_progress",
  title: "Actualizar avance de producción",
  description:
    "Actualiza el avance de producción de un artículo de un pedido de Cookies Moon: marca el artículo como hecho o define cuántas piezas van listas. Devuelve el avance del pedido completo.",
  inputSchema: {
    folio: z.string().trim().optional().describe("Folio del pedido, por ejemplo CM-2026-0007."),
    order_id: z.string().uuid().optional().describe("Identificador interno del pedido."),
    item_id: z.string().uuid().optional().describe("Identificador del artículo del pedido."),
    item_name: z
      .string()
      .trim()
      .optional()
      .describe("Nombre o SKU del artículo, si no se conoce su identificador."),
    done_quantity: z.number().int().min(0).optional().describe("Piezas terminadas."),
    is_done: z.boolean().optional().describe("Marcar el artículo como terminado por completo."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ folio, order_id, item_id, item_name, done_quantity, is_done }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    if (done_quantity === undefined && is_done === undefined)
      return {
        content: [{ type: "text", text: "Indica done_quantity o is_done." }],
        isError: true,
      };
    const supabase = supabaseForUser(ctx);
    const resolved = await resolveOrderId(supabase, { folio, order_id });
    if ("error" in resolved)
      return { content: [{ type: "text", text: resolved.error }], isError: true };

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, product_name, product_sku, quantity, done_quantity, is_done")
      .eq("order_id", resolved.id)
      .order("sort_order");
    if (itemsError)
      return { content: [{ type: "text", text: itemsError.message }], isError: true };

    let target = items?.find((i) => i.id === item_id);
    if (!target && item_name) {
      const needle = item_name.toLowerCase();
      const matches = (items ?? []).filter(
        (i) =>
          i.product_name.toLowerCase().includes(needle) ||
          (i.product_sku ?? "").toLowerCase().includes(needle),
      );
      if (matches.length > 1)
        return {
          content: [
            {
              type: "text",
              text: `Hay ${matches.length} artículos que coinciden con "${item_name}". Usa item_id: ${JSON.stringify(
                matches.map((m) => ({ id: m.id, nombre: m.product_name })),
              )}`,
            },
          ],
          isError: true,
        };
      target = matches[0];
    }
    if (!target && (items?.length ?? 0) === 1) target = items![0];
    if (!target)
      return {
        content: [
          {
            type: "text",
            text: `No se identificó el artículo. Artículos del pedido: ${JSON.stringify(
              (items ?? []).map((i) => ({ id: i.id, nombre: i.product_name, cantidad: i.quantity })),
            )}`,
          },
        ],
        isError: true,
      };

    const nextDone =
      is_done === true
        ? target.quantity
        : done_quantity !== undefined
          ? Math.min(done_quantity, target.quantity)
          : target.done_quantity;
    const nextIsDone = is_done ?? nextDone >= target.quantity;

    const { error } = await supabase
      .from("order_items")
      .update({
        done_quantity: nextDone,
        is_done: nextIsDone,
        done_at: nextIsDone ? new Date().toISOString() : null,
        done_by: nextIsDone ? (ctx.getUserId() ?? null) : null,
      })
      .eq("id", target.id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { data: after } = await supabase
      .from("order_items")
      .select("id, product_name, quantity, done_quantity, is_done")
      .eq("order_id", resolved.id)
      .order("sort_order");

    await supabase.from("activity_log").insert({
      user_id: ctx.getUserId() ?? null,
      action: "avance_agente",
      entity: "order_items",
      order_id: resolved.id,
      new_value: `${nextDone}/${target.quantity}`,
      detail: `Avance de "${target.product_name}" actualizado desde el agente`,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(after ?? [], null, 2) }],
      structuredContent: { items: after ?? [] },
    };
  },
});
