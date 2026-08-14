CREATE TABLE public.faturamento_meses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes, ano)
);
GRANT ALL ON public.faturamento_meses TO service_role;
ALTER TABLE public.faturamento_meses ENABLE ROW LEVEL SECURITY;
CREATE POLICY faturamento_meses_service_role_only ON public.faturamento_meses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_faturamento_meses_updated_at BEFORE UPDATE ON public.faturamento_meses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.faturamento_mes_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_id uuid NOT NULL REFERENCES public.faturamento_meses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes_id, product_id)
);
GRANT ALL ON public.faturamento_mes_produtos TO service_role;
ALTER TABLE public.faturamento_mes_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY faturamento_mes_produtos_service_role_only ON public.faturamento_mes_produtos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.meta_setor_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  meta_dia numeric NOT NULL DEFAULT 0,
  feriados text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, mes, ano)
);
GRANT ALL ON public.meta_setor_mes TO service_role;
ALTER TABLE public.meta_setor_mes ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_setor_mes_service_role_only ON public.meta_setor_mes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_meta_setor_mes_updated_at BEFORE UPDATE ON public.meta_setor_mes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();