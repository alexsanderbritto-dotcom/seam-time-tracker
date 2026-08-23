CREATE TABLE public.meta_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  nome text NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.meta_simulacoes TO service_role;

ALTER TABLE public.meta_simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_simulacoes_service_role_only ON public.meta_simulacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_meta_simulacoes_updated_at
  BEFORE UPDATE ON public.meta_simulacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();