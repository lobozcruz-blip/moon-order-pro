CREATE OR REPLACE FUNCTION public.place_staff_order(payload jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cust uuid;
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
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'no autorizado'; END IF;
  cust := NULLIF(payload->>'customer_id','')::uuid;
  IF cust IS NULL THEN RAISE EXCEPTION 'customer_id requerido'; END IF;
  IF jsonb_array_length(COALESCE(payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'sin artículos';
  END IF;
  dtype := NULLIF(payload->>'delivery_type','')::public.delivery_type;

  INSERT INTO public.orders (customer_id, delivery_type, status, priority, due_date, is_draft, created_by, source, review_status, client_notes)
  VALUES (
    cust, dtype, 'en_espera',
    COALESCE(NULLIF(payload->>'priority','')::public.order_priority, 'normal'),
    NULLIF(payload->>'due_date','')::date,
    false, auth.uid(), 'staff', 'aprobado', NULLIF(payload->>'notes','')
  )
  RETURNING id INTO oid;

  FOR it IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    SELECT * INTO prod FROM public.products p WHERE p.id = (it->>'product_id')::uuid;
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

  UPDATE public.orders SET folio = f WHERE id = oid;
  PERFORM public.recalc_order(oid);

  INSERT INTO public.activity_log (user_id, action, entity, order_id, detail)
  VALUES (auth.uid(), 'pedido_agente', 'orders', oid, 'Pedido creado por el equipo vía agente');

  RETURN f;
END; $function$;

REVOKE ALL ON FUNCTION public.place_staff_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_staff_order(jsonb) TO authenticated;