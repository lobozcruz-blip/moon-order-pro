import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_order",
  title: "Crear pedido",
  description:
    "Crea un pedido completo de Cookies Moon para una clienta existente: artículos (con modalidad y tamaño para cortadores), tipo de entrega y datos de envío o entrega personal. El folio, los precios y los totales se calculan en el servidor.",
  inputSchema: {
    customer_id: z
      .string()
      .uuid()
      .describe("Identificador de la clienta (usa search_customers o upsert_customer)."),
    delivery_type: z
      .enum(["envio", "entrega_personal"])
      .optional()
      .describe("Tipo de entrega del pedido."),
    priority: z.enum(["baja", "normal", "alta", "urgente"]).optional().describe("Prioridad."),
    due_date: z.string().trim().optional().describe("Fecha de entrega en formato AAAA-MM-DD."),
    notes: z.string().trim().optional().describe("Notas generales del pedido."),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid().describe("Identificador del producto del catálogo."),
          quantity: z.number().int().min(1).max(999).describe("Cantidad de piezas."),
          modality: z
            .enum(["cutter_only", "cutter_with_stamp"])
            .optional()
            .describe("Sólo cortadores: modalidad."),
          size_cm: z.number().int().optional().describe("Sólo cortadores: tamaño en centímetros."),
          notes: z.string().trim().optional().describe("Nota del artículo."),
        }),
      )
      .min(1)
      .describe("Artículos del pedido."),
    shipping: z
      .object({
        first_name: z.string().trim().optional(),
        last_name: z.string().trim().optional(),
        phone: z.string().trim().optional(),
        street: z.string().trim().optional(),
        ext_number: z.string().trim().optional(),
        int_number: z.string().trim().optional(),
        neighborhood: z.string().trim().optional(),
        municipality: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        postal_code: z.string().trim().optional(),
        references_text: z.string().trim().optional(),
        special_instructions: z.string().trim().optional(),
      })
      .optional()
      .describe("Datos de envío cuando delivery_type es envio."),
    personal: z
      .object({
        first_name: z.string().trim().optional(),
        last_name: z.string().trim().optional(),
        phone: z.string().trim().optional(),
        place: z.string().trim().optional(),
        delivery_date: z.string().trim().optional(),
        delivery_time: z.string().trim().optional(),
        instructions: z.string().trim().optional(),
      })
      .optional()
      .describe("Datos de entrega personal cuando delivery_type es entrega_personal."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: folio, error } = await supabase.rpc("place_staff_order", {
      payload: input as unknown as never,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, folio, status, priority, due_date, total, balance, customers(first_name, last_name, phone), order_items(product_name, quantity, unit_price, subtotal)",
      )
      .eq("folio", folio as string)
      .maybeSingle();

    return {
      content: [
        { type: "text", text: `Pedido creado con folio ${folio}.\n${JSON.stringify(order, null, 2)}` },
      ],
      structuredContent: { folio, order },
    };
  },
});
