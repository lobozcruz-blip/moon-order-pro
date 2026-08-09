import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Exige sesión iniciada para las páginas de la tienda de clientas. */
export async function requireClientSession() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw redirect({ to: "/tienda/acceso" });
  return { user };
}
