import { createServerFn } from "@tanstack/react-start";
import { normalizePhone, clientEmail } from "./phone";

/**
 * Consulta el estado de un número telefónico en el sistema:
 * - 'new': No existe en clientes. Puede registrarse.
 * - 'unclaimed': Existe como cliente (hizo pedidos) pero no tiene cuenta de acceso.
 * - 'registered': Ya tiene cuenta de acceso creada.
 */
export const checkPhoneStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Escribe un número de celular válido a 10 dígitos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, phone, auth_user_id")
      .eq("phone_normalized", phone)
      .maybeSingle();

    if (!customer) {
      return { status: "new" as const, phone };
    }

    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ");

    if (customer.auth_user_id) {
      return {
        status: "registered" as const,
        phone,
        customerName,
      };
    }

    return {
      status: "unclaimed" as const,
      phone,
      customerId: customer.id,
      customerName,
    };
  });

/** Genera y guarda un código OTP de 6 dígitos para validar la posesión del celular. */
export const sendClientVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Número de celular inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Invalidar códigos previos no usados para este celular
    await supabaseAdmin
      .from("phone_verification_codes")
      .update({ consumed: true })
      .eq("phone_normalized", phone);

    // Guardar nuevo código
    const { error } = await supabaseAdmin
      .from("phone_verification_codes")
      .insert({
        phone_normalized: phone,
        code,
        expires_at: expiresAt,
        consumed: false,
      });

    if (error) throw new Error(error.message);

    return { ok: true, code, expiresAt };
  });

/**
 * Reclama la cuenta de un cliente existente tras validar el código OTP.
 * Vincula el auth user con el customer_id existente SIN duplicar ni borrar pedidos o historial.
 */
export const claimClientAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; password: string }) => d)
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Número de celular inválido.");
    if ((data.password ?? "").length < 6)
      throw new Error("La contraseña debe tener al menos 6 caracteres.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar código
    const { data: validCode } = await supabaseAdmin
      .from("phone_verification_codes")
      .select("id, expires_at, consumed")
      .eq("phone_normalized", phone)
      .eq("code", data.code.trim())
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!validCode) {
      throw new Error("Código de verificación incorrecto o expirado.");
    }

    await supabaseAdmin
      .from("phone_verification_codes")
      .update({ consumed: true })
      .eq("id", validCode.id);

    // Buscar el cliente existente
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, auth_user_id")
      .eq("phone_normalized", phone)
      .maybeSingle();

    if (!customer) throw new Error("No se encontró el registro de cliente.");
    if (customer.auth_user_id) throw new Error("Esta cuenta ya está reclamada. Inicia sesión.");

    const email = clientEmail(phone);

    // Comprobar si ya existe un usuario de auth para este email
    const { data: listRes } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuth = listRes?.users?.find((u) => u.email === email);

    let userId: string;
    if (existingAuth) {
      await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
        password: data.password,
        user_metadata: { role: "cliente", phone },
      });
      userId = existingAuth.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { role: "cliente", phone },
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user!.id;
    }

    // Vincular al customer existente conservando todos sus datos y pedidos
    const { error: updateErr } = await supabaseAdmin
      .from("customers")
      .update({ auth_user_id: userId })
      .eq("id", customer.id);

    if (updateErr) throw new Error(updateErr.message);

    return { ok: true, email };
  });

/** Registra a una clienta nueva: crea su ficha de cliente y su cuenta de autenticación. */
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

/** Restablece la contraseña de una clienta tras verificar su código. */
export const resetClientPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Número de celular inválido.");
    if ((data.newPassword ?? "").length < 6)
      throw new Error("La contraseña debe tener al menos 6 caracteres.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: validCode } = await supabaseAdmin
      .from("phone_verification_codes")
      .select("id, expires_at, consumed")
      .eq("phone_normalized", phone)
      .eq("code", data.code.trim())
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!validCode) {
      throw new Error("Código de verificación incorrecto o expirado.");
    }

    await supabaseAdmin
      .from("phone_verification_codes")
      .update({ consumed: true })
      .eq("id", validCode.id);

    const email = clientEmail(phone);
    const { data: listRes } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = listRes?.users?.find((u) => u.email === email);
    if (!authUser) throw new Error("No se encontró una cuenta para este número.");

    await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: data.newPassword,
    });

    return { ok: true };
  });
