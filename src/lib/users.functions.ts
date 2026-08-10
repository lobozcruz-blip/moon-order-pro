import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppUserItem = {
  id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  created_at: string;
  user_type: "trabajador" | "cliente";
  role: "admin" | "colaborador" | "cliente";
  phone?: string | null;
  customer_id?: string;
  has_account?: boolean;
};

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

/** Lista de todos los usuarios: Trabajadores (Admins/Colaboradores) y Clientes (sólo administradores). */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sólo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Trabajadores (perfiles en profiles y roles en user_roles)
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, active, created_at")
      .order("created_at");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

    // 2. Clientes (tabla customers)
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, phone, phone_normalized, auth_user_id, created_at")
      .order("created_at", { ascending: false });

    const workers: AppUserItem[] = (profiles ?? []).map((p) => {
      const r = roles?.find((r) => r.user_id === p.id)?.role ?? "colaborador";
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        active: p.active,
        created_at: p.created_at,
        user_type: "trabajador",
        role: r,
        has_account: true,
      };
    });

    const clientUsers: AppUserItem[] = (customers ?? []).map((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      return {
        id: c.auth_user_id ?? c.id,
        customer_id: c.id,
        email: c.phone_normalized ? `${c.phone_normalized}@clientes.cookiesmoon.app` : "—",
        full_name: name || "Sin nombre",
        active: true,
        created_at: c.created_at,
        user_type: "cliente",
        role: "cliente",
        phone: c.phone ?? c.phone_normalized,
        has_account: !!c.auth_user_id,
      };
    });

    return {
      workers,
      clients: clientUsers,
      all: [...workers, ...clientUsers],
    };
  });

/** Crea un trabajador autorizado (sólo administradores). */
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

/** Cambia el rol o desactiva a un trabajador (sólo administradores). */
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
