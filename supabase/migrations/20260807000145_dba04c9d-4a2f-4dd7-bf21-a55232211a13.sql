DROP FUNCTION IF EXISTS public.ensure_profile(text);

CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name text DEFAULT NULL::text)
RETURNS TABLE(out_id uuid, out_role app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid UUID := auth.uid(); mail TEXT; has_any BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT u.email INTO mail FROM auth.users u WHERE u.id = uid;
  INSERT INTO public.profiles AS p (id, email, full_name)
  VALUES (uid, mail, COALESCE(_full_name, split_part(mail,'@',1)))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  SELECT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.role='admin') INTO has_any;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, CASE WHEN has_any THEN 'colaborador'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT uid, ur.role FROM public.user_roles ur WHERE ur.user_id = uid ORDER BY ur.role LIMIT 1;
END; $function$;

CREATE INDEX IF NOT EXISTS idx_orders_draft_created ON public.orders (is_draft, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_order ON public.activity_log (order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order ON public.order_notes (order_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);