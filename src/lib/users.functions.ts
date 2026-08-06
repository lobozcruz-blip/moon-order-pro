import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ¿Aún no existe ningún usuario? Habilita la creación del primer administrador. */
export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  return { needsBootstrap: (count ?? 0) === 0 };
});

/** Crea el primer administrador. Sólo funciona si no hay ningún usuario todavía. */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; fullName: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Ya existe al menos un usuario.");
    if (!data.email || data.password.length < 8)
      throw new Error("Correo válido y contraseña de 8+ caracteres.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user!.id, email: data.email, full_name: data.fullName });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user!.id, role: "admin" });
    return { ok: true };
  });

/** Lista de usuarios del negocio (sólo administradores). */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sólo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, active, created_at")
      .order("created_at");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    return (profiles ?? []).map((p) => ({
      ...p,
      role: roles?.find((r) => r.user_id === p.id)?.role ?? "colaborador",
    }));
  });

/** Crea un usuario autorizado (sólo administradores). */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { email: string; password: string; fullName: string; role: "admin" | "colaborador" }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sólo administradores.");
    if (!data.email || data.password.length < 8)
      throw new Error("Correo válido y contraseña de 8+ caracteres.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user!.id, email: data.email, full_name: data.fullName });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user!.id, role: data.role });
    return { ok: true };
  });

/** Cambia el rol o desactiva a un usuario (sólo administradores). */
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { userId: string; role?: "admin" | "colaborador"; active?: boolean }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sólo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    }
    if (typeof data.active === "boolean") {
      await supabaseAdmin.from("profiles").update({ active: data.active }).eq("id", data.userId);
      await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.active ? "none" : "876000h",
      });
    }
    return { ok: true };
  });
