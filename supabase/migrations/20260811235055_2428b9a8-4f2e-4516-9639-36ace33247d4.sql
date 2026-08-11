CREATE OR REPLACE FUNCTION public.next_product_sku(_category public.product_category)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p TEXT; n INT;
BEGIN
  p := CASE _category
    WHEN 'CORTADORES' THEN 'COR'
    WHEN 'STENCILS' THEN 'STE'
    WHEN 'CAJAS' THEN 'CAJ'
    ELSE 'OTR' END;
  PERFORM pg_advisory_xact_lock(hashtext('product_sku_' || p));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(sku,'-',2), '\D', '', 'g'), '')::INT), 0)
    INTO n FROM public.products WHERE sku LIKE p || '-%';
  RETURN p || '-' || lpad((n + 1)::TEXT, 4, '0');
END; $$;

REVOKE EXECUTE ON FUNCTION public.next_product_sku(public.product_category) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.create_products_bulk(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults jsonb := COALESCE(payload->'defaults', '{}'::jsonb);
  items jsonb := COALESCE(payload->'products', '[]'::jsonb);
  create_missing boolean := COALESCE((payload->>'create_missing_themes')::boolean, false);
  dup_strategy text := COALESCE(NULLIF(payload->>'duplicate_name_strategy',''), 'warn');
  it jsonb;
  idx int := 0;
  results jsonb := '[]'::jsonb;
  created int := 0;
  failed int := 0;
  v_name text; v_cat public.product_category; v_cat_txt text; v_sku text;
  v_price numeric; v_desc text; v_notes text; v_active boolean;
  v_themes jsonb; t text; theme_id uuid; theme_names text[];
  new_id uuid; warn text; dup_count int; row_res jsonb;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'no autorizado'; END IF;
  IF jsonb_typeof(items) <> 'array' THEN RAISE EXCEPTION 'products debe ser una lista'; END IF;
  IF jsonb_array_length(items) = 0 THEN RAISE EXCEPTION 'sin productos'; END IF;
  IF jsonb_array_length(items) > 500 THEN
    RAISE EXCEPTION 'límite excedido: máximo 500 productos por operación (recibidos %)', jsonb_array_length(items);
  END IF;
  IF dup_strategy NOT IN ('allow','warn','reject') THEN dup_strategy := 'warn'; END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    warn := NULL; theme_names := ARRAY[]::text[]; new_id := NULL; v_sku := NULL;
    BEGIN
      v_name := NULLIF(btrim(COALESCE(it->>'name', defaults->>'name')), '');
      IF v_name IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MISSING_NAME|Falta el nombre del producto';
      END IF;
      v_cat_txt := upper(COALESCE(it->>'category', defaults->>'category', ''));
      IF v_cat_txt NOT IN ('CORTADORES','STENCILS','CAJAS','OTROS') THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='INVALID_CATEGORY|Categoría inválida o faltante';
      END IF;
      v_cat := v_cat_txt::public.product_category;

      IF v_cat = 'CORTADORES' THEN
        v_price := NULL;
      ELSE
        v_price := COALESCE(NULLIF(it->>'base_price','')::numeric, NULLIF(defaults->>'base_price','')::numeric);
        IF v_price IS NULL THEN
          RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MISSING_PRICE|Falta el precio base para esta categoría';
        END IF;
      END IF;

      v_desc := COALESCE(NULLIF(it->>'description',''), NULLIF(defaults->>'description',''));
      v_notes := COALESCE(NULLIF(it->>'manufacturing_notes',''), NULLIF(defaults->>'manufacturing_notes',''));
      v_active := COALESCE((it->>'active')::boolean, (defaults->>'active')::boolean, true);
      v_sku := NULLIF(btrim(COALESCE(it->>'sku','')), '');

      IF v_sku IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
        RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='DUPLICATE_SKU|El SKU especificado ya existe';
      END IF;

      SELECT count(*) INTO dup_count FROM public.products WHERE lower(name) = lower(v_name);
      IF dup_count > 0 THEN
        IF dup_strategy = 'reject' THEN
          RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='DUPLICATE_NAME|Ya existe un producto con ese nombre';
        ELSIF dup_strategy = 'warn' THEN
          warn := 'Ya existen otros productos llamados ' || v_name;
        END IF;
      END IF;

      v_themes := CASE WHEN jsonb_typeof(it->'themes') = 'array' THEN it->'themes'
                       WHEN jsonb_typeof(defaults->'themes') = 'array' THEN defaults->'themes'
                       ELSE '[]'::jsonb END;

      IF v_sku IS NULL THEN v_sku := public.next_product_sku(v_cat); END IF;

      INSERT INTO public.products (sku, name, category, base_price, description, manufacturing_notes, active, created_by)
      VALUES (v_sku, v_name, v_cat, v_price, v_desc, v_notes, v_active, auth.uid())
      RETURNING id INTO new_id;

      FOR t IN SELECT btrim(value) FROM jsonb_array_elements_text(v_themes) WHERE btrim(value) <> '' LOOP
        SELECT id INTO theme_id FROM public.product_themes WHERE lower(name) = lower(t) LIMIT 1;
        IF theme_id IS NULL THEN
          IF NOT create_missing THEN
            RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='INVALID_THEME|La temática "' || t || '" no existe. Usa create_missing_themes para crearla.';
          END IF;
          INSERT INTO public.product_themes (name) VALUES (t) RETURNING id INTO theme_id;
        END IF;
        INSERT INTO public.product_theme_links (product_id, theme_id) VALUES (new_id, theme_id)
          ON CONFLICT DO NOTHING;
        theme_names := array_append(theme_names, t);
      END LOOP;

      INSERT INTO public.activity_log (user_id, action, entity, product_id, new_value, detail)
      VALUES (auth.uid(), 'product_created', 'products', new_id, v_sku,
              'Producto creado vía MCP: ' || v_name || ' (' || v_sku || ')');

      created := created + 1;
      row_res := jsonb_build_object(
        'input_index', idx, 'id', new_id, 'sku', v_sku, 'name', v_name,
        'category', v_cat_txt, 'themes', to_jsonb(theme_names),
        'base_price', v_price, 'created', true);
      IF warn IS NOT NULL THEN row_res := row_res || jsonb_build_object('warning', warn); END IF;
      results := results || jsonb_build_array(row_res);
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      results := results || jsonb_build_array(jsonb_build_object(
        'input_index', idx,
        'name', COALESCE(v_name, it->>'name'),
        'created', false,
        'error_code', CASE WHEN position('|' in SQLERRM) > 0 THEN split_part(SQLERRM, '|', 1) ELSE 'DATABASE_ERROR' END,
        'error', CASE WHEN position('|' in SQLERRM) > 0 THEN split_part(SQLERRM, '|', 2) ELSE SQLERRM END
      ));
    END;
    idx := idx + 1;
  END LOOP;

  IF idx > 1 THEN
    INSERT INTO public.activity_log (user_id, action, entity, detail)
    VALUES (auth.uid(), 'bulk_products_created', 'products',
      'MCP: solicitados ' || idx || ', creados ' || created || ', fallidos ' || failed);
  END IF;

  RETURN jsonb_build_object(
    'success', failed = 0,
    'partial_success', created > 0 AND failed > 0,
    'requested_count', idx,
    'created_count', created,
    'failed_count', failed,
    'products', results
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_products_bulk(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_products_bulk(jsonb) TO authenticated;