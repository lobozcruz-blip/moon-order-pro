
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_folio(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_order(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_demo_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_order() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_folio(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_demo_data() TO authenticated;
