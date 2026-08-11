import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { runBulkCreate } from "./bulk-create-products";

export default defineTool({
  name: "create_product",
  title: "Crear producto",
  description:
    "Creates a single product in the Cookies Moon catalog. For CORTADORES, do not provide a price because cutter pricing is determined later by size and modality. Automatically generates an SKU when none is provided. If the user asks for two or more products, use bulk_create_products instead.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Nombre del producto."),
    category: z
      .enum(["CORTADORES", "STENCILS", "CAJAS", "OTROS"])
      .describe("Categoría del producto."),
    themes: z.array(z.string().trim().min(1)).optional().describe("Temáticas, por ejemplo [\"Navidad\"]."),
    sku: z.string().trim().optional().describe("SKU manual; si se omite se genera automáticamente."),
    base_price: z
      .number()
      .nonnegative()
      .optional()
      .describe("Precio base; obligatorio salvo para CORTADORES."),
    description: z.string().trim().optional(),
    manufacturing_notes: z.string().trim().optional(),
    active: z.boolean().optional().describe("Producto activo (por defecto true)."),
    create_missing_themes: z
      .boolean()
      .optional()
      .describe("Crear la temática si no existe (por defecto false)."),
    duplicate_name_strategy: z.enum(["allow", "warn", "reject"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const { create_missing_themes, duplicate_name_strategy, ...product } = input;
    const supabase = supabaseForUser(ctx);
    const result = await runBulkCreate(supabase, {
      products: [product],
      create_missing_themes,
      duplicate_name_strategy,
    });
    if ("error" in result)
      return { content: [{ type: "text", text: result.error }], isError: true };
    const row = result.data.products?.[0] as Record<string, unknown> | undefined;
    return {
      content: [{ type: "text", text: JSON.stringify(row ?? result.data, null, 2) }],
      structuredContent: { product: row ?? null, created: result.data.created_count === 1 },
      ...(result.data.created_count === 1 ? {} : { isError: true }),
    };
  },
});
