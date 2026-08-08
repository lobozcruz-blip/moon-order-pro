import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "Listar pedidos",
  description:
    "Lista los pedidos de Cookies Moon con folio, cliente, estado, estado de pago y saldo. Permite filtrar por estado y buscar por folio o nombre de cliente.",
  inputSchema: {
    status: z
      .enum(["en_espera", "en_preparacion", "enviado", "finalizado", "pausado", "cancelado"])
      .optional()
      .describe("Filtrar por estado del pedido."),
    search: z.string().trim().optional().describe("Buscar por folio."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de pedidos (por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("orders")
      .select(
        "id, folio, status, payment_status, priority, due_date, total, paid_amount, balance, created_at, customers(first_name, last_name, phone)",
      )
      .eq("is_draft", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    if (search) q = q.ilike("folio", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
