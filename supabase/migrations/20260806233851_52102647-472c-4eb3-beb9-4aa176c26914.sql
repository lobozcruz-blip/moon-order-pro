
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','colaborador');
CREATE TYPE public.product_category AS ENUM ('CORTADORES','STENCILS','CAJAS','OTROS');
CREATE TYPE public.cutter_modality AS ENUM ('cutter_only','cutter_with_stamp');
CREATE TYPE public.order_status AS ENUM ('en_espera','en_preparacion','enviado','finalizado','pausado','cancelado');
CREATE TYPE public.payment_status AS ENUM ('sin_pago','pago_parcial','pagado','reembolso','cancelado');
CREATE TYPE public.order_priority AS ENUM ('baja','normal','alta','urgente');
CREATE TYPE public.delivery_type AS ENUM ('envio','entrega_personal');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin');
$$;

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- bootstrap profile + first admin
CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, role public.app_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); mail TEXT; has_any BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT u.email INTO mail FROM auth.users u WHERE u.id = uid;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (uid, mail, COALESCE(_full_name, split_part(mail,'@',1)))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO has_any;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, CASE WHEN has_any THEN 'colaborador'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT uid, ur.role FROM public.user_roles ur WHERE ur.user_id = uid ORDER BY ur.role LIMIT 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_profile(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id UUID, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo administradores'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END; $$;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  contact_channel TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.customers (phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_customers_upd BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT,
  recipient_first_name TEXT,
  recipient_last_name TEXT,
  phone TEXT,
  street TEXT, ext_number TEXT, int_number TEXT, neighborhood TEXT,
  municipality TEXT, city TEXT, state TEXT, postal_code TEXT,
  references_text TEXT, special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category public.product_category NOT NULL,
  base_price NUMERIC(12,2),
  description TEXT,
  manufacturing_notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_price_rule CHECK (
    (category = 'CORTADORES' AND base_price IS NULL) OR
    (category <> 'CORTADORES' AND base_price IS NOT NULL AND base_price >= 0)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_products_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT,
  external_url TEXT,
  kind TEXT DEFAULT 'diseno',
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- CUTTER PRICES
CREATE TABLE public.cutter_price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modality public.cutter_modality NOT NULL,
  size_cm INT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (modality, size_cm)
);
GRANT SELECT, UPDATE ON public.cutter_price_rules TO authenticated;
GRANT ALL ON public.cutter_price_rules TO service_role;
ALTER TABLE public.cutter_price_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_cpr_upd BEFORE UPDATE ON public.cutter_price_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.cutter_price_rules (modality, size_cm, price) VALUES
('cutter_only',5,25),('cutter_only',6,30),('cutter_only',7,33),('cutter_only',8,35),
('cutter_only',9,40),('cutter_only',10,45),('cutter_only',11,50),('cutter_only',12,55),
('cutter_only',13,60),('cutter_only',14,65),('cutter_only',15,70),('cutter_only',16,75),
('cutter_only',17,80),('cutter_only',18,85),('cutter_only',19,90),('cutter_only',20,95),
('cutter_with_stamp',5,50),('cutter_with_stamp',6,55),('cutter_with_stamp',7,60),('cutter_with_stamp',8,70),
('cutter_with_stamp',9,80),('cutter_with_stamp',10,90),('cutter_with_stamp',11,100),('cutter_with_stamp',12,110),
('cutter_with_stamp',13,120),('cutter_with_stamp',14,135),('cutter_with_stamp',15,145),('cutter_with_stamp',16,155),
('cutter_with_stamp',17,165),('cutter_with_stamp',18,180),('cutter_with_stamp',19,190),('cutter_with_stamp',20,220);

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  delivery_type public.delivery_type,
  status public.order_status NOT NULL DEFAULT 'en_espera',
  payment_status public.payment_status NOT NULL DEFAULT 'sin_pago',
  priority public.order_priority NOT NULL DEFAULT 'normal',
  assignee_id UUID REFERENCES auth.users(id),
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_orders_upd BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_folio_counters (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.order_folio_counters TO authenticated;
GRANT ALL ON public.order_folio_counters TO service_role;
ALTER TABLE public.order_folio_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assign_folio(_order_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y INT := EXTRACT(YEAR FROM now())::INT; n INT; f TEXT; cur TEXT;
BEGIN
  SELECT folio INTO cur FROM public.orders WHERE id = _order_id;
  IF cur IS NOT NULL THEN RETURN cur; END IF;
  INSERT INTO public.order_folio_counters (year, last_number) VALUES (y,1)
    ON CONFLICT (year) DO UPDATE SET last_number = public.order_folio_counters.last_number + 1
    RETURNING last_number INTO n;
  f := 'CM-' || y || '-' || lpad(n::TEXT, 4, '0');
  UPDATE public.orders SET folio = f WHERE id = _order_id;
  RETURN f;
END; $$;
GRANT EXECUTE ON FUNCTION public.assign_folio(UUID) TO authenticated;

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_sku TEXT,
  product_name TEXT NOT NULL,
  category public.product_category NOT NULL,
  description TEXT,
  notes TEXT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  cutter_modality public.cutter_modality,
  cutter_size_cm INT,
  done_quantity INT NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES auth.users(id),
  price_overridden BOOLEAN NOT NULL DEFAULT false,
  price_override_reason TEXT,
  price_applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_items_cutter_rule CHECK (
    category <> 'CORTADORES' OR (cutter_modality IS NOT NULL AND cutter_size_cm IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  storage_path TEXT,
  external_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_images TO authenticated;
GRANT ALL ON public.order_item_images TO service_role;
ALTER TABLE public.order_item_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  important BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.order_notes(id) ON DELETE CASCADE,
  storage_path TEXT,
  external_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_attachments TO authenticated;
GRANT ALL ON public.note_attachments TO service_role;
ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'transferencia',
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_attachments TO authenticated;
GRANT ALL ON public.payment_attachments TO service_role;
ALTER TABLE public.payment_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shipping_details (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  first_name TEXT, last_name TEXT, phone TEXT,
  street TEXT, ext_number TEXT, int_number TEXT, neighborhood TEXT,
  municipality TEXT, city TEXT, state TEXT, postal_code TEXT,
  references_text TEXT, special_instructions TEXT,
  carrier TEXT, shipping_cost NUMERIC(12,2) DEFAULT 0,
  estimated_ship_date DATE, tracking_number TEXT, tracking_image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_details TO authenticated;
GRANT ALL ON public.shipping_details TO service_role;
ALTER TABLE public.shipping_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.personal_delivery_details (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  first_name TEXT, last_name TEXT, phone TEXT,
  place TEXT, delivery_date DATE, delivery_time TEXT, instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_delivery_details TO authenticated;
GRANT ALL ON public.personal_delivery_details TO service_role;
ALTER TABLE public.personal_delivery_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'completada',
  total_rows INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_imports TO authenticated;
GRANT ALL ON public.product_imports TO service_role;
ALTER TABLE public.product_imports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.product_imports(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw_data JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_import_rows TO authenticated;
GRANT ALL ON public.product_import_rows TO service_role;
ALTER TABLE public.product_import_rows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  old_value TEXT,
  new_value TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.activity_log (created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- POLICIES: authenticated staff full access; deletes admin-only where sensitive
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','customer_addresses','products','product_images',
    'orders','order_items','order_item_images','order_notes','note_attachments',
    'payments','payment_attachments','shipping_details','personal_delivery_details',
    'product_imports','product_import_rows'] LOOP
    EXECUTE format('CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE TO authenticated USING (true)', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['customers','products','orders','payments','product_imports'] LOOP
    EXECUTE format('CREATE POLICY "%1$s_delete_admin" ON public.%1$s FOR DELETE TO authenticated USING (public.is_admin())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['customer_addresses','product_images','order_items','order_item_images',
    'order_notes','note_attachments','payment_attachments','shipping_details',
    'personal_delivery_details','product_import_rows'] LOOP
    EXECUTE format('CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END $$;

CREATE POLICY "cpr_select" ON public.cutter_price_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpr_update_admin" ON public.cutter_price_rules FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "folio_select" ON public.order_folio_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Recalculate order totals
CREATE OR REPLACE FUNCTION public.recalc_order(_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s NUMERIC := 0; p NUMERIC := 0; o RECORD; t NUMERIC; b NUMERIC; ps public.payment_status;
BEGIN
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
END; $$;
GRANT EXECUTE ON FUNCTION public.recalc_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_recalc_order() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_order(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END; $$;
CREATE TRIGGER t_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order();
CREATE TRIGGER t_payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order();

CREATE OR REPLACE FUNCTION public.purge_demo_data()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo administradores'; END IF;
  DELETE FROM public.orders WHERE is_demo;
  DELETE FROM public.products WHERE is_demo;
  DELETE FROM public.customers WHERE is_demo;
END; $$;
GRANT EXECUTE ON FUNCTION public.purge_demo_data() TO authenticated;
