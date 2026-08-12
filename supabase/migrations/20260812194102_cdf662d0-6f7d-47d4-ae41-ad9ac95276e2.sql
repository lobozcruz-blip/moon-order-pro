DROP POLICY IF EXISTS "ajustes lectura autenticada" ON public.app_settings;
CREATE POLICY "ajustes lectura restringida" ON public.app_settings
FOR SELECT TO authenticated
USING (public.is_staff() OR key = 'whatsapp_number' OR key LIKE 'brand_%');

REVOKE EXECUTE ON FUNCTION public.next_product_sku(public.product_category) FROM authenticated, anon, PUBLIC;