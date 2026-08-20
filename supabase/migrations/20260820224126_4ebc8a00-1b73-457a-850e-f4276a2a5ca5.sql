DELETE FROM public.production_entries pe
USING public.esteira_producao e
WHERE e.id = pe.lote_id
  AND pe.entry_date = DATE '2026-08-11'
  AND pe.slot_start = '07:00'
  AND pe.slot_end = '08:00'
  AND e.op_interna IN ('406','411','412','413','414','415','416','417')
  AND pe.created_at >= TIMESTAMPTZ '2026-08-20 22:37:00+00';

SELECT public.recalc_product_status(p.id) FROM public.products p
WHERE p.id IN (SELECT produto_id FROM public.esteira_producao WHERE op_interna IN ('406','411','412','413','414','415','416','417'));