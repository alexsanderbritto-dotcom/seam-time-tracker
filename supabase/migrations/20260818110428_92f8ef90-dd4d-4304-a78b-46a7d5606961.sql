-- 1. Esteira: múltiplas frações por produto
ALTER TABLE public.esteira_producao DROP CONSTRAINT IF EXISTS esteira_producao_produto_id_key;
ALTER TABLE public.esteira_producao
  ADD COLUMN IF NOT EXISTS op_interna text,
  ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 0;

UPDATE public.esteira_producao e
SET op_interna = COALESCE(e.op_interna, p.op_interna),
    quantidade = CASE WHEN e.quantidade > 0 THEN e.quantidade ELSE COALESCE(p.total_quantity, 0) END
FROM public.products p
WHERE p.id = e.produto_id;

CREATE UNIQUE INDEX IF NOT EXISTS esteira_producao_produto_op_interna_ativo_idx
  ON public.esteira_producao (produto_id, op_interna)
  WHERE status = 'ativo';

-- 2. Marcações ligadas à fração
ALTER TABLE public.production_entries
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.esteira_producao(id) ON DELETE SET NULL;

UPDATE public.production_entries pe
SET lote_id = e.id
FROM public.esteira_producao e
WHERE pe.lote_id IS NULL
  AND e.produto_id = pe.product_id
  AND e.status = 'ativo';

CREATE INDEX IF NOT EXISTS production_entries_lote_id_idx ON public.production_entries (lote_id);

-- 3. Metas de produção por fração
ALTER TABLE public.meta_producao_setor_dia
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.esteira_producao(id) ON DELETE CASCADE;

UPDATE public.meta_producao_setor_dia m
SET lote_id = e.id
FROM public.esteira_producao e
WHERE m.lote_id IS NULL AND e.produto_id = m.product_id AND e.status = 'ativo';

ALTER TABLE public.meta_producao_setor_dia
  DROP CONSTRAINT IF EXISTS meta_producao_setor_dia_sector_id_data_product_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS meta_producao_setor_dia_sector_data_lote_idx
  ON public.meta_producao_setor_dia (sector_id, data, product_id, lote_id);

-- 4. Status do produto considera todas as frações
CREATE OR REPLACE FUNCTION public.recalc_product_status(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ops int;
  _produced int;
  _lotes int;
  _new text;
BEGIN
  SELECT count(*) INTO _ops FROM public.operations WHERE product_id = _product_id;

  SELECT COALESCE(sum(quantity),0) INTO _produced
  FROM public.production_entries WHERE product_id = _product_id;

  SELECT count(*) INTO _lotes
  FROM public.esteira_producao
  WHERE produto_id = _product_id AND status = 'ativo';

  IF _produced <= 0 THEN
    _new := 'em_estoque';
  ELSIF _ops > 0 AND _lotes > 0 AND NOT EXISTS (
    SELECT 1
    FROM public.esteira_producao l
    WHERE l.produto_id = _product_id
      AND l.status = 'ativo'
      AND (
        l.quantidade <= 0
        OR EXISTS (
          SELECT 1 FROM public.operations o
          WHERE o.product_id = _product_id
            AND COALESCE((
              SELECT sum(pe.quantity) FROM public.production_entries pe
              WHERE pe.operation_id = o.id AND pe.lote_id = l.id
            ), 0) < l.quantidade
        )
      )
  ) THEN
    _new := 'finalizado';
  ELSE
    _new := 'em_producao';
  END IF;

  UPDATE public.products
  SET status = _new, updated_at = now()
  WHERE id = _product_id AND status IS DISTINCT FROM _new;
END;
$function$;