import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_customers",
  title: "Buscar clientes",
  description:
    "Busca clientes de Cookies Moon por nombre o teléfono y devuelve sus datos de contacto y notas internas.",
  inputSchema: {
    search: z.string().trim().optional().describe("Nombre o teléfono a buscar."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de clientes (por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("customers")
      .select("id, first_name, last_name, phone, contact_channel, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search)
      q = q.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`,
      );
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { customers: data ?? [] },
    };
  },
});
