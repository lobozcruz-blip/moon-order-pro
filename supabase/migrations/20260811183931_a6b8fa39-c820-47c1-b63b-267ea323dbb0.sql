-- 1) is_staff(): require an explicit staff role (admin/colaborador) AND active profile
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','colaborador')
      AND p.active
  );
$$;

-- 2) Prevent self-reactivation: policy-level block on changing `active` (defense in depth with the trigger)
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE TO authenticated
USING ((id = auth.uid()) OR public.is_admin())
WITH CHECK (
  public.is_admin()
  OR (
    id = auth.uid()
    AND active IS NOT DISTINCT FROM (SELECT p2.active FROM public.profiles p2 WHERE p2.id = auth.uid())
  )
);

-- also harden the guard trigger so it always applies to non-admins
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
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

-- 3) SECURITY DEFINER exposure: no PUBLIC/anon execute anywhere; keep only what the app needs
REVOKE ALL ON FUNCTION public.assign_folio(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_profile(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_profile_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_client() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_customer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_client_order(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_staff_order(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_demo_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalc_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recalc_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;