import { createServerFn } from "@tanstack/react-start";
import { normalizePhone, clientEmail } from "./phone";

/** Registra a una clienta: crea su acceso y su ficha de cliente. */
export const registerClient = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { firstName: string; lastName: string; phone: string; password: string }) => d,
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Escribe un número de celular válido a 10 dígitos.");
    if (!data.firstName.trim()) throw new Error("Escribe tu nombre.");
    if ((data.password ?? "").length < 6)
      throw new Error("La contraseña debe tener al menos 6 caracteres.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id, auth_user_id")
      .eq("phone_normalized", phone)
      .maybeSingle();

    if (existing?.auth_user_id)
      throw new Error("Ese celular ya tiene una cuenta. Inicia sesión.");

    const email = clientEmail(phone);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: "cliente", phone },
    });
    if (error) throw new Error(error.message);
    const userId = created.user!.id;

    if (existing) {
      await supabaseAdmin
        .from("customers")
        .update({
          auth_user_id: userId,
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim() || null,
          phone: data.phone.trim(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("customers").insert({
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim() || null,
        phone: data.phone.trim(),
        phone_normalized: phone,
        auth_user_id: userId,
        contact_channel: "Tienda en línea",
      });
    }

    return { ok: true, email };
  });
