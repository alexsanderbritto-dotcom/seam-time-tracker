ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS peca_piloto text,
  DROP COLUMN IF EXISTS pilot_photos;

ALTER TABLE public.products
  ADD CONSTRAINT products_peca_piloto_check
  CHECK (peca_piloto IS NULL OR peca_piloto IN ('sim','nao','devolvido'));