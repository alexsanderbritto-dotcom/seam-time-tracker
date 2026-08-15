CREATE TABLE public.meta_producao_setor_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  data date NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, data, product_id)
);

GRANT ALL ON public.meta_producao_setor_dia TO service_role;

ALTER TABLE public.meta_producao_setor_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_producao_setor_dia_service_role_only
  ON public.meta_producao_setor_dia
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_meta_producao_setor_dia_updated_at
  BEFORE UPDATE ON public.meta_producao_setor_dia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();