ALTER TABLE public.marcadores
  ADD COLUMN IF NOT EXISTS cargo text NOT NULL DEFAULT 'usuario';

ALTER TABLE public.marcadores
  ADD CONSTRAINT marcadores_cargo_check CHECK (cargo IN ('usuario','admin'));

UPDATE public.marcadores SET cargo = 'admin';