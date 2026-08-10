import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { normalizePhone } from "@/lib/phone";

export default defineTool({
  name: "upsert_customer",
  title: "Crear o encontrar cliente",
  description:
    "Da de alta una clienta de Cookies Moon con nombre y teléfono. Si el teléfono ya existe, devuelve la ficha existente en lugar de duplicarla.",
  inputSchema: {
    first_name: z.string().trim().min(1).describe("Nombre de la clienta."),
    last_name: z.string().trim().optional().describe("Apellido de la clienta."),
    phone: z.string().trim().optional().describe("Teléfono a 10 dígitos."),
    contact_channel: z
      .string()
      .trim()
      .optional()
      .describe("Canal de contacto, por ejemplo whatsapp o instagram."),
    notes: z.string().trim().optional().describe("Notas internas de la clienta."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ first_name, last_name, phone, contact_channel, notes }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const normalized = phone ? normalizePhone(phone) : null;
    if (normalized) {
      const { data: existing, error: findError } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone, contact_channel, notes")
        .eq("phone_normalized", normalized)
        .maybeSingle();
      if (findError)
        return { content: [{ type: "text", text: findError.message }], isError: true };
      if (existing)
        return {
          content: [
            {
              type: "text",
              text: `Ya existía esta clienta:\n${JSON.stringify(existing, null, 2)}`,
            },
          ],
          structuredContent: { customer: existing, created: false },
        };
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name,
        last_name: last_name ?? null,
        phone: phone ?? null,
        phone_normalized: normalized,
        contact_channel: contact_channel ?? null,
        notes: notes ?? null,
        created_by: ctx.getUserId() ?? null,
      })
      .select("id, first_name, last_name, phone, contact_channel, notes")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { customer: data, created: true },
    };
  },
});
