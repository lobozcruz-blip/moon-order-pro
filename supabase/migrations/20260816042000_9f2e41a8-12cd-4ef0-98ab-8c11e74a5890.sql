-- ==============================================================================
-- Migración: Triggers automáticos para recálculo financiero de pedidos y reparación de datos
-- ==============================================================================

-- 1. Función principal de recálculo oficial (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.recalc_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _subtotal NUMERIC := 0;
  _paid NUMERIC := 0;
  _discount NUMERIC := 0;
  _shipping_cost NUMERIC := 0;
  _total NUMERIC := 0;
  _balance NUMERIC := 0;
  _status public.order_status;
  _payment_status public.payment_status;
BEGIN
  -- 1. Calcular subtotal a partir de order_items
  SELECT COALESCE(SUM(subtotal), 0)
  INTO _subtotal
  FROM public.order_items
  WHERE order_id = _order_id;

  -- 2. Calcular total pagado a partir de payments
  SELECT COALESCE(SUM(amount), 0)
  INTO _paid
  FROM public.payments
  WHERE order_id = _order_id;

  -- 3. Obtener descuento, costo de envío y status actual del pedido
  SELECT
    COALESCE(discount, 0),
    COALESCE(shipping_cost, 0),
    status
  INTO
    _discount,
    _shipping_cost,
    _status
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 4. Fórmula oficial: total = subtotal - discount + shipping_cost
  _total := GREATEST(0, _subtotal - _discount + _shipping_cost);
  _balance := GREATEST(0, _total - _paid);

  -- 5. Estado de pago
  IF _status = 'cancelado' THEN
    _payment_status := 'cancelado';
  ELSIF _paid <= 0 THEN
    _payment_status := 'sin_pago';
  ELSIF _balance <= 0 THEN
    _payment_status := 'pagado';
  ELSE
    _payment_status := 'pago_parcial';
  END IF;

  -- 6. Actualizar los campos calculados de la orden
  UPDATE public.orders
  SET
    subtotal = _subtotal,
    total = _total,
    paid_amount = _paid,
    balance = _balance,
    payment_status = _payment_status
  WHERE id = _order_id;
END;
$$;

-- Mantener la función segura para que no sea invocada directamente vía RPC por clientes no privilegiados
REVOKE ALL ON FUNCTION public.recalc_order(uuid) FROM PUBLIC, anon;

-- 2. Trigger para cambios en order_items (INSERT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION public.trg_recalc_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.recalc_order(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS t_items_recalc ON public.order_items;
CREATE TRIGGER t_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalc_order();

-- 3. Trigger para cambios en payments (INSERT, UPDATE, DELETE)
DROP TRIGGER IF EXISTS t_payments_recalc ON public.payments;
CREATE TRIGGER t_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalc_order();

-- 4. Trigger para cambios financieros directos en orders (shipping_cost, discount)
CREATE OR REPLACE FUNCTION public.trg_order_financial_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.recalc_order(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_order_financial_recalc ON public.orders;
CREATE TRIGGER t_order_financial_recalc
AFTER UPDATE OF shipping_cost, discount ON public.orders
FOR EACH ROW
WHEN (
  OLD.shipping_cost IS DISTINCT FROM NEW.shipping_cost
  OR OLD.discount IS DISTINCT FROM NEW.discount
)
EXECUTE FUNCTION public.trg_order_financial_recalc();

-- 5. Sincronización de shipping_details con orders.shipping_cost
CREATE OR REPLACE FUNCTION public.trg_shipping_details_cost_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.shipping_cost IS DISTINCT FROM NEW.shipping_cost) OR (TG_OP = 'INSERT') THEN
    UPDATE public.orders
    SET shipping_cost = COALESCE(NEW.shipping_cost, 0)
    WHERE id = NEW.order_id
      AND shipping_cost IS DISTINCT FROM COALESCE(NEW.shipping_cost, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_shipping_details_cost_sync ON public.shipping_details;
CREATE TRIGGER t_shipping_details_cost_sync
AFTER INSERT OR UPDATE OF shipping_cost ON public.shipping_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_shipping_details_cost_sync();

-- 6. Reparación retroactiva de TODOS los pedidos existentes en la base de datos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.recalc_order(r.id);
  END LOOP;
END;
$$;
