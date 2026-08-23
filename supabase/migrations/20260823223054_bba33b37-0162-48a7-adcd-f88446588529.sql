ALTER TABLE public.marcadores DROP CONSTRAINT IF EXISTS marcadores_cargo_check;

ALTER TABLE public.marcadores
  ADD CONSTRAINT marcadores_cargo_check
  CHECK (cargo IN ('admin', 'usuario', 'setor'));

ALTER TABLE public.marcadores DROP CONSTRAINT IF EXISTS marcadores_setor_coerente_check;

ALTER TABLE public.marcadores
  ADD CONSTRAINT marcadores_setor_coerente_check
  CHECK (
    (cargo = 'setor' AND setor_id IS NOT NULL)
    OR (cargo <> 'setor' AND setor_id IS NULL)
  );