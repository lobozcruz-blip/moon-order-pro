-- 1) Prevent privilege escalation via profiles.active
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'no autorizado: solo administradores pueden cambiar el estado activo';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'no autorizado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_profiles_guard ON public.profiles;
CREATE TRIGGER t_profiles_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_updates();

-- also add an explicit WITH CHECK to the update policy
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE TO authenticated
USING ((id = auth.uid()) OR public.is_admin())
WITH CHECK ((id = auth.uid()) OR public.is_admin());

-- 2) Reduce SECURITY DEFINER surface exposed to signed-in users
REVOKE ALL ON FUNCTION public.recalc_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recalc_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- remaining definer helpers are required by RLS policies / client flows; keep them
-- available to signed-in users only (never anon), with their internal auth checks.
REVOKE ALL ON FUNCTION public.assign_folio(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_profile(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_client() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_customer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_client_order(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_demo_data() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assign_folio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_customer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_client_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_demo_data() TO authenticated;