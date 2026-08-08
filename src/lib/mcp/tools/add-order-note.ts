import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_order_note",
  title: "Agregar nota a un pedido",
  description:
    "Agrega una nota interna a un pedido de Cookies Moon, opcionalmente marcada como importante.",
  inputSchema: {
    folio: z.string().trim().optional().describe("Folio del pedido, por ejemplo CM-2026-0007."),
    order_id: z.string().uuid().optional().describe("Identificador interno del pedido."),
    title: z.string().trim().optional().describe("Título breve de la nota."),
    body: z.string().trim().min(1).describe("Contenido de la nota."),
    important: z.boolean().optional().describe("Marcar la nota como importante."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ folio, order_id, title, body, important }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    if (!folio && !order_id)
      return { content: [{ type: "text", text: "Indica un folio o un order_id." }], isError: true };
    const supabase = supabaseForUser(ctx);

    let resolvedId = order_id;
    if (!resolvedId) {
      const { data: found, error: findError } = await supabase
        .from("orders")
        .select("id")
        .eq("folio", folio!)
        .maybeSingle();
      if (findError)
        return { content: [{ type: "text", text: findError.message }], isError: true };
      if (!found)
        return { content: [{ type: "text", text: "No se encontró el pedido." }], isError: true };
      resolvedId = found.id;
    }

    const { data, error } = await supabase
      .from("order_notes")
      .insert({
        order_id: resolvedId,
        title: title ?? null,
        body,
        important: important ?? false,
        created_by: ctx.getUserId() ?? null,
      })
      .select("id, order_id, title, body, important, created_at")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { note: data },
    };
  },
});
