ALTER TABLE public.products ADD COLUMN IF NOT EXISTS op_interna text;

CREATE TABLE public.esteira_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  data_adicionado timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (produto_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esteira_producao TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esteira_producao TO authenticated;
GRANT ALL ON public.esteira_producao TO service_role;

ALTER TABLE public.esteira_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY esteira_producao_public_all ON public.esteira_producao
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_esteira_producao_updated_at
  BEFORE UPDATE ON public.esteira_producao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();