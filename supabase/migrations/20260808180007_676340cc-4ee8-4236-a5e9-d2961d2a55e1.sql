-- Helper: staff = tiene rol asignado y perfil activo
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.active
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_order(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND o.created_by = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_order(uuid) FROM anon;

-- ============ SELECT / INSERT / UPDATE: solo personal activo ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','customer_addresses','orders','order_items','order_item_images','order_notes',
    'note_attachments','payments','payment_attachments','shipping_details','personal_delivery_details',
    'products','product_images','product_imports','product_import_rows','activity_log',
    'cutter_price_rules','order_folio_counters'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_staff())', t || '_select', t);
  END LOOP;
END $$;

-- nombres de política que no siguen el patrón
DROP POLICY IF EXISTS activity_select ON public.activity_log;
DROP POLICY IF EXISTS cpr_select ON public.cutter_price_rules;
DROP POLICY IF EXISTS folio_select ON public.order_folio_counters;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','customer_addresses','orders','order_items','order_item_images','order_notes',
    'note_attachments','payments','payment_attachments','shipping_details','personal_delivery_details',
    'products','product_images','product_imports','product_import_rows'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_staff())', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t || '_update', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS activity_insert ON public.activity_log;
CREATE POLICY activity_insert ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_staff());

-- ============ DELETE: admin o dueño del recurso ============
DROP POLICY IF EXISTS order_items_delete ON public.order_items;
CREATE POLICY order_items_delete ON public.order_items FOR DELETE TO authenticated
  USING (public.is_admin() OR public.owns_order(order_id));

DROP POLICY IF EXISTS order_notes_delete ON public.order_notes;
CREATE POLICY order_notes_delete ON public.order_notes FOR DELETE TO authenticated
  USING (public.is_admin() OR created_by = auth.uid() OR public.owns_order(order_id));

DROP POLICY IF EXISTS shipping_details_delete ON public.shipping_details;
CREATE POLICY shipping_details_delete ON public.shipping_details FOR DELETE TO authenticated
  USING (public.is_admin() OR public.owns_order(order_id));

DROP POLICY IF EXISTS personal_delivery_details_delete ON public.personal_delivery_details;
CREATE POLICY personal_delivery_details_delete ON public.personal_delivery_details FOR DELETE TO authenticated
  USING (public.is_admin() OR public.owns_order(order_id));

DROP POLICY IF EXISTS order_item_images_delete ON public.order_item_images;
CREATE POLICY order_item_images_delete ON public.order_item_images FOR DELETE TO authenticated
  USING (public.is_admin() OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.id = order_item_id AND public.owns_order(oi.order_id)));

DROP POLICY IF EXISTS note_attachments_delete ON public.note_attachments;
CREATE POLICY note_attachments_delete ON public.note_attachments FOR DELETE TO authenticated
  USING (public.is_admin()
    OR EXISTS (SELECT 1 FROM public.order_notes n WHERE n.id = note_id
               AND (n.created_by = auth.uid() OR public.owns_order(n.order_id))));

DROP POLICY IF EXISTS payment_attachments_delete ON public.payment_attachments;
CREATE POLICY payment_attachments_delete ON public.payment_attachments FOR DELETE TO authenticated
  USING (public.is_admin()
    OR EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id
               AND (p.created_by = auth.uid() OR public.owns_order(p.order_id))));

DROP POLICY IF EXISTS customer_addresses_delete ON public.customer_addresses;
CREATE POLICY customer_addresses_delete ON public.customer_addresses FOR DELETE TO authenticated
  USING (public.is_admin()
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.created_by = auth.uid()));

DROP POLICY IF EXISTS product_images_delete ON public.product_images;
CREATE POLICY product_images_delete ON public.product_images FOR DELETE TO authenticated
  USING (public.is_admin()
    OR EXISTS (SELECT 1 FROM public.products pr WHERE pr.id = product_id AND pr.created_by = auth.uid()));

DROP POLICY IF EXISTS product_import_rows_delete ON public.product_import_rows;
CREATE POLICY product_import_rows_delete ON public.product_import_rows FOR DELETE TO authenticated
  USING (public.is_admin()
    OR EXISTS (SELECT 1 FROM public.product_imports pi WHERE pi.id = import_id AND pi.created_by = auth.uid()));

-- ============ profiles / user_roles ============
DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS roles_read ON public.user_roles;
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============ Almacenamiento privado ============
DROP POLICY IF EXISTS cm_storage_select ON storage.objects;
CREATE POLICY cm_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cookies-moon' AND public.is_staff());

DROP POLICY IF EXISTS cm_storage_insert ON storage.objects;
CREATE POLICY cm_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cookies-moon' AND public.is_staff() AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS cm_storage_update ON storage.objects;
CREATE POLICY cm_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cookies-moon' AND (public.is_admin() OR owner_id = auth.uid()::text))
  WITH CHECK (bucket_id = 'cookies-moon' AND (public.is_admin() OR owner_id = auth.uid()::text));

DROP POLICY IF EXISTS cm_storage_delete ON storage.objects;
CREATE POLICY cm_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cookies-moon' AND (public.is_admin() OR owner_id = auth.uid()::text));

-- ============ Funciones SECURITY DEFINER ============
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_folio(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_demo_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

CREATE OR REPLACE FUNCTION public.assign_folio(_order_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE y INT := EXTRACT(YEAR FROM now())::INT; n INT; f TEXT; cur TEXT;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'no autorizado'; END IF;
  SELECT folio INTO cur FROM public.orders WHERE id = _order_id;
  IF cur IS NOT NULL THEN RETURN cur; END IF;
  INSERT INTO public.order_folio_counters (year, last_number) VALUES (y,1)
    ON CONFLICT (year) DO UPDATE SET last_number = public.order_folio_counters.last_number + 1
    RETURNING last_number INTO n;
  f := 'CM-' || y || '-' || lpad(n::TEXT, 4, '0');
  UPDATE public.orders SET folio = f WHERE id = _order_id;
  RETURN f;
END; $function$;

CREATE OR REPLACE FUNCTION public.recalc_order(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s NUMERIC := 0; p NUMERIC := 0; o RECORD; t NUMERIC; b NUMERIC; ps public.payment_status;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN RAISE EXCEPTION 'no autorizado'; END IF;
  SELECT COALESCE(SUM(subtotal),0) INTO s FROM public.order_items WHERE order_id = _order_id;
  SELECT COALESCE(SUM(amount),0) INTO p FROM public.payments WHERE order_id = _order_id;
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o IS NULL THEN RETURN; END IF;
  t := s - COALESCE(o.discount,0) + COALESCE(o.shipping_cost,0);
  b := t - p;
  IF o.status = 'cancelado' THEN ps := 'cancelado';
  ELSIF p <= 0 THEN ps := 'sin_pago';
  ELSIF b <= 0 THEN ps := 'pagado';
  ELSE ps := 'pago_parcial'; END IF;
  UPDATE public.orders SET subtotal = s, total = t, paid_amount = p, balance = b, payment_status = ps
  WHERE id = _order_id;
END; $function$;