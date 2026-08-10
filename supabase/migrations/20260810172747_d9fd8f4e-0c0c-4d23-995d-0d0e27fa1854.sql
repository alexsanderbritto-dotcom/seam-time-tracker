CREATE OR REPLACE FUNCTION public.recalc_product_status(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total int;
  _ops int;
  _done int;
  _produced int;
  _new text;
BEGIN
  SELECT total_quantity INTO _total FROM public.products WHERE id = _product_id;
  IF _total IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO _ops FROM public.operations WHERE product_id = _product_id;

  SELECT COALESCE(sum(quantity),0) INTO _produced
  FROM public.production_entries WHERE product_id = _product_id;

  SELECT count(*) INTO _done FROM (
    SELECT o.id
    FROM public.operations o
    LEFT JOIN public.production_entries pe ON pe.operation_id = o.id
    WHERE o.product_id = _product_id
    GROUP BY o.id
    HAVING COALESCE(sum(pe.quantity),0) >= _total
  ) t;

  IF _produced <= 0 THEN
    _new := 'em_estoque';
  ELSIF _ops > 0 AND _done = _ops AND _total > 0 THEN
    _new := 'finalizado';
  ELSE
    _new := 'em_producao';
  END IF;

  UPDATE public.products
  SET status = _new, updated_at = now()
  WHERE id = _product_id AND status IS DISTINCT FROM _new;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_product_in_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_product_status(OLD.product_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_product_status(NEW.product_id);
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM public.recalc_product_status(OLD.product_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_product_in_production ON public.production_entries;
CREATE TRIGGER trg_mark_product_in_production
AFTER INSERT OR UPDATE OR DELETE ON public.production_entries
FOR EACH ROW EXECUTE FUNCTION public.mark_product_in_production();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.products LOOP
    PERFORM public.recalc_product_status(r.id);
  END LOOP;
END $$;