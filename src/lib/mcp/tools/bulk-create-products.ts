import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const categorySchema = z.enum(["CORTADORES", "STENCILS", "CAJAS", "OTROS"]);

export const productInputSchema = z.object({
  name: z.string().trim().min(1).describe("Nombre del producto."),
  category: categorySchema.optional().describe("Categoría (si no, se toma de defaults)."),
  themes: z.array(z.string().trim().min(1)).optional().describe("Temáticas del producto."),
  sku: z.string().trim().optional().describe("SKU manual; si se omite se genera automáticamente."),
  base_price: z
    .number()
    .nonnegative()
    .optional()
    .describe("Precio base. No aplica para CORTADORES (su precio depende de modalidad y tamaño)."),
  description: z.string().trim().optional(),
  manufacturing_notes: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export const defaultsSchema = z.object({
  category: categorySchema.optional(),
  themes: z.array(z.string().trim().min(1)).optional(),
  base_price: z.number().nonnegative().optional(),
  description: z.string().trim().optional(),
  manufacturing_notes: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export type BulkResult = {
  success: boolean;
  partial_success: boolean;
  requested_count: number;
  created_count: number;
  failed_count: number;
  products: Array<Record<string, unknown>>;
};

export async function runBulkCreate(
  supabase: ReturnType<typeof supabaseForUser>,
  payload: Record<string, unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("create_products_bulk", { payload });
  if (error) return { error: error.message as string };
  return { data: data as unknown as BulkResult };
}

export default defineTool({
  name: "bulk_create_products",
  title: "Crear productos en masa",
  description:
    "Creates multiple Cookies Moon catalog products in a single operation. USE THIS TOOL WHEN THE USER REQUESTS MULTIPLE PRODUCTS (two or more) instead of calling create_product repeatedly. Supports shared defaults such as category and themes, and automatically generates a unique SKU for every product when none is provided (COR-, STE-, CAJ-, OTR-). For CORTADORES do not provide a price: cutter pricing is determined later by size and modality. Returns each created product with its assigned SKU, plus per-item errors for partial failures.",
  inputSchema: {
    defaults: defaultsSchema.optional().describe("Valores aplicados a todos los productos de la lista."),
    products: z
      .array(productInputSchema)
      .min(1)
      .max(500)
      .describe("Lista de productos a crear (máximo 500 por llamada)."),
    create_missing_themes: z
      .boolean()
      .optional()
      .describe("Crear automáticamente las temáticas que no existan (por defecto false)."),
    duplicate_name_strategy: z
      .enum(["allow", "warn", "reject"])
      .optional()
      .describe("Qué hacer si ya existe un producto con el mismo nombre (por defecto warn)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const result = await runBulkCreate(supabase, input as Record<string, unknown>);
    if ("error" in result)
      return { content: [{ type: "text", text: result.error }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      structuredContent: result.data as unknown as Record<string, unknown>,
    };
  },
});
