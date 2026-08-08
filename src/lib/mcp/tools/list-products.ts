import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "Listar productos",
  description:
    "Lista el catálogo de Cookies Moon (SKU, nombre, categoría y precio base). Permite filtrar por categoría, por texto y por productos activos.",
  inputSchema: {
    category: z
      .enum(["CORTADORES", "STENCILS", "CAJAS", "OTROS"])
      .optional()
      .describe("Filtrar por categoría."),
    search: z.string().trim().optional().describe("Buscar por nombre o SKU."),
    only_active: z.boolean().optional().describe("Sólo productos activos (por defecto true)."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de productos (por defecto 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, search, only_active, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("products")
      .select("id, sku, name, category, base_price, active, description")
      .order("sku")
      .limit(limit ?? 50);
    if (category) q = q.eq("category", category);
    if (only_active !== false) q = q.eq("active", true);
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
