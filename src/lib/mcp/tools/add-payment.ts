import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveOrderId } from "../resolve-order";

export default defineTool({
  name: "add_payment",
  title: "Registrar pago",
  description:
    "Registra un abono en un pedido de Cookies Moon (monto, fecha, método y referencia). El total pagado y el saldo se recalculan automáticamente.",
  inputSchema: {
    folio: z.string().trim().optional().describe("Folio del pedido, por ejemplo CM-2026-0007."),
    order_id: z.string().uuid().optional().describe("Identificador interno del pedido."),
    amount: z.number().positive().describe("Monto del abono en pesos."),
    method: z
      .string()
      .trim()
      .optional()
      .describe("Método de pago: efectivo, transferencia, deposito, otro. Por defecto transferencia."),
    paid_at: z.string().trim().optional().describe("Fecha del pago en formato AAAA-MM-DD."),
    reference: z.string().trim().optional().describe("Referencia o folio del comprobante."),
    notes: z.string().trim().optional().describe("Nota interna del pago."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ folio, order_id, amount, method, paid_at, reference, notes }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const resolved = await resolveOrderId(supabase, { folio, order_id });
    if ("error" in resolved)
      return { content: [{ type: "text", text: resolved.error }], isError: true };

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        order_id: resolved.id,
        amount,
        method: method?.trim() || "transferencia",
        paid_at: paid_at?.trim() || new Date().toISOString().slice(0, 10),
        reference: reference ?? null,
        notes: notes ?? null,
        created_by: ctx.getUserId() ?? null,
      })
      .select("id, amount, method, paid_at, reference")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { data: order } = await supabase
      .from("orders")
      .select("folio, total, paid_amount, balance, payment_status")
      .eq("id", resolved.id)
      .maybeSingle();

    await supabase.from("activity_log").insert({
      user_id: ctx.getUserId() ?? null,
      action: "pago_agente",
      entity: "payments",
      order_id: resolved.id,
      new_value: String(amount),
      detail: "Pago registrado desde el agente",
    });

    return {
      content: [{ type: "text", text: JSON.stringify({ payment, order }, null, 2) }],
      structuredContent: { payment, order },
    };
  },
});
