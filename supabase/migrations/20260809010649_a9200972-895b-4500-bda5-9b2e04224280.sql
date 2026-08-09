-- 1) Vínculo de cuenta de clienta
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_normalized text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_normalized_key
  ON public.customers (phone_normalized) WHERE phone_normalized IS NOT NULL;

-- 2) Origen y revisión de pedidos
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'aprobado',
  ADD COLUMN IF NOT EXISTS client_notes text;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_source_chk CHECK (source IN ('interno','cliente'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_review_status_chk CHECK (review_status IN ('pendiente','aprobado','rechazado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS orders_review_status_idx ON public.orders (review_status);

-- 3) Ajustes del negocio
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ajustes lectura autenticada" ON public.app_settings;
CREATE POLICY "ajustes lectura autenticada" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ajustes escritura admin" ON public.app_settings;
CREATE POLICY "ajustes escritura admin" ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
INSERT INTO public.app_settings (key, value) VALUES ('whatsapp_number', '')
  ON CONFLICT (key) DO NOTHING;

-- 4) Identidad de clienta
CREATE OR REPLACE FUNCTION public.is_client()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_client() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_client() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_customer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid() LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.my_customer_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_customer_id() TO authenticated;

-- 5) Lecturas del catálogo para clientas
DROP POLICY IF EXISTS "clientas ven catalogo activo" ON public.products;
CREATE POLICY "clientas ven catalogo activo" ON public.products
  FOR SELECT TO authenticated USING (active AND public.is_client());

DROP POLICY IF EXISTS "clientas ven imagenes de catalogo" ON public.product_images;
CREATE POLICY "clientas ven imagenes de catalogo" ON public.product_images
  FOR SELECT TO authenticated USING (
    public.is_client() AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.active)
  );

DROP POLICY IF EXISTS "clientas ven precios de cortadores" ON public.cutter_price_rules;
CREATE POLICY "clientas ven precios de cortadores" ON public.cutter_price_rules
  FOR SELECT TO authenticated USING (active AND public.is_client());

-- 6) Ficha y direcciones propias
DROP POLICY IF EXISTS "clienta ve su ficha" ON public.customers;
CREATE POLICY "clienta ve su ficha" ON public.customers
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS "clienta edita su ficha" ON public.customers;
CREATE POLICY "clienta edita su ficha" ON public.customers
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "clienta gestiona sus direcciones" ON public.customer_addresses;
CREATE POLICY "clienta gestiona sus direcciones" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (customer_id = public.my_customer_id())
  WITH CHECK (customer_id = public.my_customer_id());

-- 7) Pedidos propios de la clienta (sólo lectura)
DROP POLICY IF EXISTS "clienta ve sus pedidos" ON public.orders;
CREATE POLICY "clienta ve sus pedidos" ON public.orders
  FOR SELECT TO authenticated USING (customer_id = public.my_customer_id());

DROP POLICY IF EXISTS "clienta ve articulos de sus pedidos" ON public.order_items;
CREATE POLICY "clienta ve articulos de sus pedidos" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = public.my_customer_id())
  );

DROP POLICY IF EXISTS "clienta ve su envio" ON public.shipping_details;
CREATE POLICY "clienta ve su envio" ON public.shipping_details
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = public.my_customer_id())
  );

DROP POLICY IF EXISTS "clienta ve su entrega personal" ON public.personal_delivery_details;
CREATE POLICY "clienta ve su entrega personal" ON public.personal_delivery_details
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = public.my_customer_id())
  );

-- 8) Alta de pedido desde la tienda (precios recalculados en servidor)
CREATE OR REPLACE FUNCTION public.place_client_order(payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cust uuid := public.my_customer_id();
  oid uuid;
  it jsonb;
  prod RECORD;
  qty int;
  modality public.cutter_modality;
  size_cm int;
  unit numeric;
  sub numeric;
  total numeric := 0;
  dtype public.delivery_type;
  y int := EXTRACT(YEAR FROM now())::int;
  n int;
  f text;
  idx int := 0;
BEGIN
  IF cust IS NULL THEN RAISE EXCEPTION 'no autorizado'; END IF;
  IF jsonb_array_length(COALESCE(payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'carrito vacío';
  END IF;
  dtype := (payload->>'delivery_type')::public.delivery_type;

  INSERT INTO public.orders (customer_id, delivery_type, status, priority, is_draft, created_by, source, review_status, client_notes)
  VALUES (cust, dtype, 'en_espera', 'normal', false, auth.uid(), 'cliente', 'pendiente', NULLIF(payload->>'notes',''))
  RETURNING id INTO oid;

  FOR it IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    SELECT * INTO prod FROM public.products p WHERE p.id = (it->>'product_id')::uuid AND p.active;
    IF prod IS NULL THEN CONTINUE; END IF;
    qty := GREATEST(1, LEAST(999, COALESCE((it->>'quantity')::int, 1)));
    modality := NULLIF(it->>'modality','')::public.cutter_modality;
    size_cm := NULLIF(it->>'size_cm','')::int;
    IF prod.category = 'CORTADORES' AND modality IS NOT NULL AND size_cm IS NOT NULL THEN
      SELECT r.price INTO unit FROM public.cutter_price_rules r
        WHERE r.modality = modality AND r.size_cm = size_cm AND r.active;
      unit := COALESCE(unit, 0);
    ELSE
      unit := COALESCE(prod.base_price, 0);
      modality := NULL; size_cm := NULL;
    END IF;
    sub := unit * qty;
    total := total + sub;
    INSERT INTO public.order_items (
      order_id, product_id, product_sku, product_name, category, quantity, unit_price, subtotal,
      cutter_modality, cutter_size_cm, notes, sort_order
    ) VALUES (
      oid, prod.id, prod.sku, prod.name, prod.category, qty, unit, sub,
      modality, size_cm, NULLIF(it->>'notes',''), idx
    );
    idx := idx + 1;
  END LOOP;

  IF dtype = 'envio' THEN
    INSERT INTO public.shipping_details (order_id, first_name, last_name, phone, street, ext_number, int_number,
      neighborhood, municipality, city, state, postal_code, references_text, special_instructions)
    VALUES (oid,
      payload#>>'{shipping,first_name}', payload#>>'{shipping,last_name}', payload#>>'{shipping,phone}',
      payload#>>'{shipping,street}', payload#>>'{shipping,ext_number}', payload#>>'{shipping,int_number}',
      payload#>>'{shipping,neighborhood}', payload#>>'{shipping,municipality}', payload#>>'{shipping,city}',
      payload#>>'{shipping,state}', payload#>>'{shipping,postal_code}', payload#>>'{shipping,references_text}',
      payload#>>'{shipping,special_instructions}');
  ELSIF dtype = 'entrega_personal' THEN
    INSERT INTO public.personal_delivery_details (order_id, first_name, last_name, phone, place, delivery_date, delivery_time, instructions)
    VALUES (oid,
      payload#>>'{personal,first_name}', payload#>>'{personal,last_name}', payload#>>'{personal,phone}',
      payload#>>'{personal,place}', NULLIF(payload#>>'{personal,delivery_date}','')::date,
      payload#>>'{personal,delivery_time}', payload#>>'{personal,instructions}');
  END IF;

  INSERT INTO public.order_folio_counters (year, last_number) VALUES (y,1)
    ON CONFLICT (year) DO UPDATE SET last_number = public.order_folio_counters.last_number + 1
    RETURNING last_number INTO n;
  f := 'CM-' || y || '-' || lpad(n::text, 4, '0');

  UPDATE public.orders SET folio = f, subtotal = total, total = total, balance = total WHERE id = oid;

  INSERT INTO public.activity_log (user_id, action, entity, order_id, detail)
  VALUES (auth.uid(), 'pedido_tienda', 'orders', oid, 'Pedido creado desde la tienda de clientas');

  RETURN f;
END; $$;
REVOKE EXECUTE ON FUNCTION public.place_client_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_client_order(jsonb) TO authenticated;