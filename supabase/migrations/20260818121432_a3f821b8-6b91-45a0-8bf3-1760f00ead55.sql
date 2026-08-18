ALTER TABLE public.faturamento_mes_produtos
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.esteira_producao(id) ON DELETE CASCADE;

INSERT INTO public.faturamento_mes_produtos (mes_id, product_id, lote_id)
SELECT f.mes_id, f.product_id, e.id
FROM public.faturamento_mes_produtos f
JOIN public.esteira_producao e ON e.produto_id = f.product_id
WHERE f.lote_id IS NULL
  AND e.status IN ('ativo','removido')
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS faturamento_mes_produtos_lote_uniq
  ON public.faturamento_mes_produtos (mes_id, product_id, lote_id)
  WHERE lote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS faturamento_mes_produtos_master_uniq
  ON public.faturamento_mes_produtos (mes_id, product_id)
  WHERE lote_id IS NULL;